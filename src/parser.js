var fs = require('fs');
var args = process.argv;
var file = fs.readFileSync(args[2]);
var tfm = require('./tfm')

var debug = true;

function log(message, color, force) {
  if(!debug && (force || color) !== true ) return;
  if(color === true) color = '';

  console.log(
    '%s %s %s',
    color ? '\033[' + color + 'm' : '',
    message,
    color ? '\033[0m' : ''
  );
}

var f;
var stack = [];
//          h  v  w  x  y  z  
var pos = [ 0, 0, 0, 0, 0, 0 ];
var metadata = { num: 0, den: 0, mag: 0, s: 0 };
/**
 * scaleDim(measurement)
 *
 * Scales the given measurement by the documents specified `num`, `den`,
 * and `mag` properties (defined in the preamble).
 * 
 */
function scaleDim(measurement) {
  //  `7227` TeX units in `254` cm
  //  den = 7227 * 2^16
  // 0.035277778 pts = 1 cm
  return ((measurement * metadata.num) / (metadata.mag * metadata.den)) * 0.035277778;
}

function getParamOffset(opcode, offset) {
  //  preamble values
  var fmt, num, den, mag, k;
  // general command values (character, width, height, vertical, x, y, z, font)
  var ch, w, h, v, x, y, z;
  var i, p, l, u, s, t;

  var c = [];
  
  switch(opcode) {
    case 137:
      // put_rule, identical to following set_rule (no change in `h`)
    case 132:
      // `set_rule; a[4], b[4]`
      a = file.slice(offset, offset + 4).readIntBE(0, 4); offset += 4;
      b = file.slice(offset, offset + 4).readIntBE(0, 4); offset += 4;
      // bottom left corner of box at (h,v)
      if(opcode === 132) pos[0] += b;
      log('Set rule: ' + w + ', ' + h);
    break;
    case 138:
      log('NOP', 35);
    break;
    case 139:
      // Beginning of a page (BOP):
      // Set stack empty 
      stack = [];
      // and (h,v,w,x,y,z):=(0,0,0,0,0,0)
      pos   = [ 0, 0, 0, 0, 0, 0 ];
      // Set font to undefined value
      f = null;
      // Get the page information (10 4-byte sequences, + 1 byte)
      c = [];
      i = 0;

      while(i < 10) {
        c[i++] = file.slice(offset, offset + 4).readUInt32BE(0);
        offset += 4;
      }

      log('\n==== BOP ====');
      log('[ ' + c.join(', ') + ' ]\n');
    break;
    case 140:
      // End of a page (EOP):
      // Stack should be empty
      if(stack.length) log('STACK IS NOT EMPTY', 32);
      log('\n==== EOP ====\n');
      // PRINT what we have since last BOP
    break;
    case 141:
      stack.push(pos);
      log('PUSH', 33);
      console.log('h: %s, v: %s, w: %s, x: %s, y: %s, z: %s', pos[0], pos[1], pos[2], pos[3], pos[4], pos[5]);
      pos = [ 0, 0, 0, 0, 0, 0 ];
    break;
    case 142:
      // pop and assign values to current h,v,w,x,y,z
      pos = stack.pop();
      log('POP!', 33);
      console.log('h: %s, v: %s, w: %s, x: %s, y: %s, z: %s', pos[0], pos[1], pos[2], pos[3], pos[4], pos[5]);
    break;
    case 247:
      // PREAMBLE !!
      // i[1]
      i   = file.slice(offset,offset+1); offset += 1;
      // num[4]
      num = file.slice(offset,offset+4); offset += 4;
      // den[4]
      den = file.slice(offset,offset+4); offset += 4;
      // mag[4]
      mag = file.slice(offset,offset+4); offset += 4;
      //  k[1]
      k   = file.slice(offset,offset+1).readUInt8(0); offset += 1;
      x   = file.slice(offset,offset+k); offset += k;

      metadata.num = num.readUInt32BE(0);
      metadata.den = den.readUInt32BE(0);
      metadata.mag = mag.readUInt32BE(0);

      if(num <= 0) throw Error('Invalid numerator (must be > 0)');
      if(den <= 0) throw Error('Invalid Denominator (must be > 0)');

      var resolution = 300.0; // ppi
      var tfm_conv = (25400000.0 / num.readUInt32BE(0)) * ( den.readUInt32BE(0) / 473628672 ) / 16.0;
      var conv = (num.readUInt32BE(0)/254000.0) * (resolution/den.readUInt32BE(0));
      var true_conv = conv;
      conv = true_conv * (mag.readUInt32BE(0)/1000.0);

      log('\n=== PREAMBLE ===\n', 36, true);
      log([
        'Format:', i.readUInt8(0), '\n',
        'Numerator:', num.readUInt32BE(0), '\n',
        'Denominator:', den.readUInt32BE(0), '\n',
        'Magnification:', mag.readUInt32BE(0), '\n',
        'Conversion:', conv, ' pixels per DVI Unit\n',
        'Comment:', x.toString('ascii'), '\n'
      ].join(' '), 36, true);
    break;
    case 248:
      // POSTAMBLE!!!!
      // p[4], num[4], den[4], mag[4], l[4], u[4], s[2], t[2];
      p = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4;  // final `bop`
      num = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4; // see pre
      den = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4; // see pre
      mag = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4; // see pre
      l = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4; // height+depth of tallest page
      u = file.slice(offset, offset+4).readIntBE(0, 4); offset += 4; // width of widest page
      s = file.slice(offset, offset+2).readIntBE(0, 2); offset += 2; // max stack depth
      t = file.slice(offset, offset+2).readIntBE(0, 2); offset += 2; // page count

      log('\n=== POSTAMBLE ===\n', 36, true);
      log([
        'Last BOP:', p, '\n',
        'Numerator:', num, '\n',
        'Denominator:', den, '\n',
        'Magnification:', mag, '\n',
        'Tallest Page:', l, '\n',
        'Widest Page:', u, '\n',
        'Max Stack:', s, '\n',
        'Pages:', t, '\n'
      ].join(' '), 36, true);
    break;
    case 249:
      // POST POST
      // q[4], i[1]; 223's
      q = file.slice(offset, offset+4); offset += 4; // pointer to beginning of postamble
      i = file.slice(offset, offset+1); offset += 1; // see preamble
      offset = file.length;
    break;
    default:
      if(opcode >= 0 && opcode <= 127) {
        // `set_char_i`
        i = opcode;
        c = String.fromCharCode(i);

        log('set_char_i: ' + c);
      }
      else if(opcode >= 128 && opcode <= 131) {
        // `seti c[i]`, set0 = set_char_0, set1 = setting for 128 <= c < 256
        i = opcode - 128;
        // set0 is set_char_0
        if(i === 0) console.log('set_char_0');
        // set1 is range 128-255
        // set2 is range beyond 255
        if(i > 0) ch = file.slice(offset,offset+1).readUInt8(0); offset += 1;
        log('seti: ' + String.fromCharCode(i) + '\n');
      }
      else if(opcode >= 133 && opcode <= 136) {
        // `puti (1 <= i <= 4); c[i]`
        i = opcode - 132;
        //  typset char at (h, v)
        ch = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        // log('Setting Character ' + String.fromCharCode(ch) + '\n');
      }
      else if(opcode >= 143 && opcode <= 146) {
        //  righti
        //  arg is up to next 4 bytes (in 2's compliment)
        i = opcode - 142; // 1 <= i <= 4
        //  update the horizontal point
        b = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        pos[0] += b;
        log('righti: ' + pos[0]);
      }
      else if(opcode >= 147 && opcode <= 151) {
        // wi
        i = opcode - 147; // 0 <= i <= 4
        
        if(i > 0) {
          pos[2] = file.slice(offset, offset + i).readIntBE(0, i);
          offset += i;
        }
        
        pos[0] += pos[2];
        log('wi: ' + pos[0]);
      }
      else if(opcode >= 152 && opcode <= 156) {
        // xi
        // This command changes the current x spacing and moves right by b.
        i = opcode - 151; // 1 <= i <= 4

        if(b > 0) {
          pos[3] = file.slice(offset, offset + i).readIntBE(0, i);
          offset += i;
        }

        pos[0] += pos[3];
        log('xi: ' + pos[0]);
      }
      else if(opcode >= 157 && opcode <= 160) {
        // downi
        i = opcode - 156; // 1 <= i <= 4
        a = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        pos[1] += a;
        log('downi: ' + pos[1]);
      }
      else if(opcode >= 161 && opcode <= 165) {
        // yi
        i = opcode - 161; // 0 <= i <= 4

        if(i > 0) {
          pos[4] = file.slice(offset, offset + i).readIntBE(0, i);
          offset += i;
        }

        pos[1] += pos[4];
        log('yi: ' + pos[1]);
      }
      else if(opcode >= 166 && opcode <= 170) {
        // zi
        i = opcode - 166; // 0 <= i <= 4

        if(i > 0) {
          pos[5] = file.slice(offset, offset + i).readIntBE(0, i);
          offset += i;
        }

        pos[1] += pos[5];
        log('Y size: ' + pos[1]); 
      }
      else if(opcode >= 171 && opcode <= 234) {
        // `fnt_num_i (0 <= i <= 63)`
        f = opcode - 171; // check if font was defined via `fnt_def`
        log('Set font to: ' + f);
      }
      else if(opcode >= 235 && opcode <= 238) {
        //  `fnti`
        i = opcode - 234; // (1 <= i <= 4);
        f = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        log('Set font to: ' + f);
      }
      else if(opcode >= 239 && opcode <= 242) {
        // SPECIALS (used for graphics, non-text/block related visuals)
        // This command is undefined in general; it functions as a k+i+1$-byte
        // nop unless special DVI-reading programs are being used.
        i = opcode - 238; // 1 <= i <= 4
        k = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        x = file.slice(offset, offset + k); offset += k;
        log('Special Bytes: ' + k);
        offset += k + 1;
      }
      else if(opcode >= 243 && opcode <= 246) {
        // `fnt_defi (1 <= i <= 4);
        i = opcode - 242;
        // k[i]     - font ()
        f = file.slice(offset, offset + i).readIntBE(0, i); offset += i;
        // c[4]     - check sum of `.tfm` file
        c = file.slice(offset, offset+4); offset += 4;
        // s[4]     - fixed-point scale factor (applied to char widths of font)
        s = file.slice(offset, offset+4); offset += 4;
        // d[4]     - design-size factors with the magnification (`s/1000`)
        d = file.slice(offset, offset+4); offset += 4;
        // a[1]     - length of directory path of font (`./` if a = 0)
        a = file.slice(offset, offset+1).readInt8(0); offset += 1; // UInt
        // l[1]     - length of font name
        l = file.slice(offset, offset+1).readInt8(0); offset += 1; // UInt
        // n[a+l]   - font name (first `a` bytes is dir, remaining `l` = name)
        n = file.slice(offset, offset + a + l); offset += (a + l);
        
        // Font definitions must appear before the first use of a particular
        // font number. 
        // Once font k is defined, it must not be defined again; 
        log('\n==== FONT DEF ====\n');
        log([
          'Font Name:', n.toString('ascii'), '\n',
          'Font Number:', f, '\n',
          'TFM Path:', getMetrics(n.toString('ascii')), '\n',
          'Checksum:', c.readUInt32BE(0), '\n',
          'Scale Factor:', s.readUInt32BE(0), '\n',
          'Design Size:', d.readUInt32BE(0), '\n'
        ].join(' '), 36);
      }
    }

  return offset;
}

var p = 0;

for(var i = 0; i < file.length; p = i) {
  i = getParamOffset(file.readUInt8(i++), i);
  // console.log(i-p);
}
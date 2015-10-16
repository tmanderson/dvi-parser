# DVI Parser

The goal with this project is to eventually have a complete [DVI](https://en.wikipedia.org/wiki/Device_independent_file_format) toolset
written in node. Once complete, this will hopefully be used to implement
TeX document conversions completely in node (particularly a highly configurable
HTML/CSS/JS output).

I'll also be updating the Wiki for those that are interested. Currently, I there's
a [DVI Specification Explained](wiki/DVI-Specification-Explained) section that I
put together for my own benefit (sourced from a few different online pages).

### TODO
- [x] DVI Parser
- [ ] TFM Parser
- [ ] Metric management (right now, fonts are assumed to be in mactex's default location)
- [ ] HTML/CSS/JS conversion

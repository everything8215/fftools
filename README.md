# FFTools

FFTools is a data editor for 8-bit and 16-bit Final Fantasy games. The latest
version is always available here: https://everything8215.github.io/fftools/

FFTools is based on the FF6Tools ROM editor but with a different design
philosophy. Instead of modifying a ROM file directly, FFTools modifies a
json file containing game data which has been extracted from a ROM file.
The modified json file can then be encoded and assembled from scratch into
a new ROM file. This method requires a full disassembly of the game and an
assembler/linker such as cc65.

FFTools is currently missing many of the features available in FF6Tools.
However, because it is designed to build a ROM from scratch, it has the
potential to be a very powerful tool without the drawbacks and limitations
of a ROM editor like FF6Tools.

Currently, the only game supported by FFTools is Final
Fantasy IV for the Super Nintendo/Super Famicom. The full disassembly is
available here: https://github.com/everything8215/ff4. After ripping the
game data from your ROM, use FFTools modify the file `ff4-en-data.json` or
`ff4-jp-data.json` for the English and Japanese versions, respectively.
After saving, the modifications will be encoded and assembled the next time
you build a ROM.

# capture-flag.io

A multiplayer capture the flag game built with [context-engine](https://github.com/OrtheSnowJames/context-engine).

## About

This game is built using my custom TypeScript game engine. While there are many game engines available, none quite matched the features I was looking for. So I did what any reasonable developer would do - built my own engine! 

### Design Philosophy
- Minimalist cubic player designs (intentional!)
- Whatever I think goes into the game goes into the game

## Installation

### Prerequisites
- Node.js & npm 
- Web browser (Firefox recommended, although it's going to be the same regardless)

### For Arch Linux Users
```bash
sudo pacman -S nodejs npm firefox
```
For other platforms, install the equivalent packages using your package manager.

### Setup
1. Clone the repository
```bash
git clone https://github.com/OrtheSnowJames/capture-flag-io.git
cd capture-flag-io
```

2. Install dependencies
```bash
npm install
```

3. Start the game
```bash
node src/index.js
```

4. Open in browser
```bash
firefox http://localhost:4566
```

## Future Plans
- Stripe integration
- Skins - Work In Progress, Avalible as operator with !op commands
- Publishing context-engine as an npm package

## Current Status
- Core gameplay implemented
- Some bugs still present
- Active development

## Contributing
Feel free to open issues, but just know pull requests will be outdated because I don't want to split files. Issues are fine, PRs will probably get declined. (sorry)


## Playing the Game
I recommend going into this blindly, figuring out things as you go. (hint: spacebar does something cool)
But if you are really lost, check the [guide](./guide/basicguide.md).
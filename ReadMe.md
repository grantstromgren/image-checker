# Image Checker
This is a simple Node.js CLI tool that will check the base64 of an image against a store of base64 strings. The purpose
to find exact image matches or partial duplicates within a store.

**Note: ** This is meant to be a minimal package and as such the `store.db` file is just local. Using a database and
querying in that database is a much better route.

## Requirements
Although more packages exist to improve functionality, this was kept basic to make it as vanilla node as possible.
- Node

## Setup
- `git clone git@github.com/grantstromgren/image-checker && cd image-checker`
- `node index.js --help` to view available commands

## Examples
`node index.js flag anvil-partial.png` - flags the `anvil-partial.png` by storing the base64 string into a newly created 
`store.db` file.

`node index.js check images` - checks all images in directory against `store.db`

`node index.js check images --partial` - chunks the base64 into defined lengths and searches for each chunk within 
the `store.db`

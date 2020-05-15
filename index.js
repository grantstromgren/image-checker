/**
 * Disclaimer: This is a coding sample that I created but also can be a useful tool. Feel free to use it, but know that
 * storing images in a database will ultimately be much more performant than within a single file.
 *
 * For help, run `node index.js --help`
 */

const fs = require('fs');

// Config items, these are alterable as desired
const config = {
    imageExtensions: 'jpg|jpeg|png', // which image extensions are accepted
    partialChunks: 120, // how many characters the base64 file is chunked into, when reviewing partial image searches
}

// Log level names, these can be changed if desired but should stay as they are
const logLevels = [ 'INFO', 'WARNING', 'CRITICAL' ]

// Helper methods
const helpers = {
    checkFileExtension: string => RegExp(config.imageExtensions).test(string),
}

// Check for at least one argument
process.argv.length <= 2 && exit('Command missing. Use --help to view current commands.', 2);

// Check for --help
process.argv.includes('--help') && help();

// Because we rely on store.db as our central data store, we will create it if it doesn't exist
if (!fs.existsSync('store.db')) {
    fs.writeFileSync('store.db', '');
}

/**
 * Imagefile is the class for all images that match the validation criteria in validate()
 *
 * Methods within this class will allow us to get the base64, chunk the base64, and check the strings against a data
 * string that is provided.
 */
class ImageFile {
    constructor(filePath) {
        this.filePath = filePath;

        this.base64 = new Buffer(fs.readFileSync(this.filePath)).toString('base64');

        this.chunks = this.base64.match(RegExp(`.{1,${config.partialChunks}}`, "g"));
    }

    /**
     * Checks if chunk exists in the data provided
     * @param data The data read from the store.db file
     * @returns boolean
     */
    chunksExistInData(data) {
        let exists = false;
        this.chunks.every(chunk => {
            let checkChunk = RegExp(chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(data);

            if (checkChunk) {
                exists = true;
                return false;
            }

            return true;
        });

        return exists;
    }

    /**
     * Checks if the image exists in the data provided
     * @param data The data read from the store.db file
     * @returns boolean
     */
    existsInData(data) {
        return RegExp(this.base64.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(data);
    }
}

/**
 * Preloads some items for the called commands, such as validating the image or directory passed and reading the data
 * currently in the store.db file
 * @param args Any passed args, just in case we need them
 * @returns { { data: *, stats: { total: number, tally: number }, files: [] } }
 */
function preload(args = []) {
    let arg = fs.statSync(args[0]);
    let files = [];

    if (arg.isDirectory()) {
        // This is a directory, we'll enter all listed files into the files array
        let items = fs.readdirSync(args[0]);

        // We are only using items that match our validation
        items.forEach(item => {
            const filePath = `${args[0]}/${item}`;
            validate(filePath) && files.push(new ImageFile(filePath));
        });
    }

    if (arg.isFile() && validate(args[0])) {
        // This is a file and passed validation
        let file = new ImageFile(args[0]);
        files.push(file)
    }
    files.length === 0 && exit('No files with accepted extensions found', 1);

    let stats = {
        tally: 0,
        total: files.length,
    }

    let data = fs.readFileSync('store.db');

    return { files, stats, data }
}

/**
 * Flags an image or directory of images and sends the files to be stored.
 * @param args Options included with the command
 */
function flag(args = []) {
    let { files, stats, data } = preload(args);

    files.forEach(file => {
        const exists = file.existsInData(data)
        if (!exists) {
            const save = store(file, data);
            save && stats.tally++;
        } else {
            log(`File already exists in data store: ${file.filePath}`, 0);
        }
    });

    exit(`Flag complete. Added ${stats.tally}/${stats.total} file(s).`, 0)
}

/**
 * Checks an image or directory of images against the current store.db. Information returned to screen and log file.
 * @param args Options included with the command
 */
function check(args = []) {
    let { files, stats, data } = preload(args);

    files.forEach(file => {
        let chunkExists = false;
        if (args.includes('--partial')) {
            // If partial is included with the command, we'll check the chunks of the base64 against the store
            chunkExists = file.chunksExistInData(data);
        }

        if (file.existsInData(data) || chunkExists) {
            log(`File found in data store: ${file.filePath}`, 0);
            stats.tally++;
        } else {
            log(`Did not find file in data store: ${file.filePath}`, 0);
        }
    });

    exit(`Check complete. Found ${stats.tally}/${stats.total} file(s) matching in data store.`, 0)
}


/**
 * Performs validation checks against the file based upon the command used.
 * @param file A file by string location relative to this file.
 * @returns boolean
 */
function validate(file) {
    if (!helpers.checkFileExtension(file)) {
        return false
    }

    return true;
}

/**
 * Stores a file's base64 in the data store. It will not store duplicate images.
 * @param file A file by string location relative to this file.
 * @param data The data string from within the store.db
 * @returns boolean
 */
function store(file, data) {
    if (file.existsInData(data)) {
        log(`File has already been added to data store: ${file}`, 1);
        return false;
    }

    try {
        fs.appendFileSync('store.db', file.base64 + '\n');
        log(`File flagged: ${file.filePath}`, 0);
        return true;
    } catch(err) {
        exit(`Error storing file: ${file.filePath}`, 2, err);
    }

}

/**
 * Writes to the log file and screen.
 * @param message The message to be logged
 * @param level The level of log to be recorded. Affects text at the start of the log message.
 * @param err If an err exists with the log, enter it here, it will only display err if it exists
 */
function log(message, level = 0, err = null) {
    let logMessage = `${logLevels[level]} ${message}`;

    if (err) {
        logMessage = `${logMessage}\n${err}`
    }

    try {
        console.info(logMessage);
        fs.appendFileSync('logs.log', logMessage + '\n');
    } catch (err) {
        console.error(err);
    }
}

/**
 * Exits the program, creating a log error if err exists.
 * @param message The message to be logged
 * @param level The level of log to be recorded. Affects text at the start of th elog message.
 * @param err An error response to be dumped out
 */
function exit(message, level = 0, err = null) {
    log(message, level, err);

    log('Exiting...', 0);
    process.exit(1);
}

/**
 * Calls the help info
 */
function help() {
    switch(process.argv[2]) {
        case 'flag':
            console.info('The flag command will flag either an individual image or directory of images.\n\n' +
                        'ex: node index.js flag images/anvil-partial.png');
            break;
        case 'check':
            console.info('The check command will check an image, or directory of images. it includes the\n' +
                        'optional parameter --partial, which will break up the base64 into chunks.\n\n' +
                        'ex: node index.js check images/anvil-partial.png');
            break;
        case '--help':
            console.info('Welcome to the image checker tool. This tool will check the base64 of an image\n' +
                'against store of base64 strings. Images can be flagged by directory, and checked\n' +
                'by directory.\n\n' +
                'Commands:\n' +
                'flag image|dir - flags an image or dir and stores it into the store.db\n' +
                'check image|dir [...options] - checks an image or dir against the store.db\n\n' +
                'Options:\n' +
                '--partial - chunks image(s) base64 and checks each chunk against the store.db')
            break;
        default:
            console.info('Command is not found.')
    }

    process.exit(1);
}

// Dynamically run the function based on the argument passed. Includes the rest of the args into an array to the func.
try {
    eval(process.argv[2])(process.argv.slice(3));
} catch (err) {
    // An error is most likely to happen if the command is not found
    exit(`Command not found: ${process.argv[2]}`, 2, err);
}
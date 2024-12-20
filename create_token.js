require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const inquirer = require('inquirer');
const fetch = require("node-fetch");

// Flags

// Set VALIDATE_TOKEN to false to skip the
// fetch request validation step and just 
// generate the token ('offline mode')
const VALIDATE_TOKEN = true;

// Set SAVE_TO_FILE to false to simply
// log the output JWT to the console
const SAVE_TO_FILE = true;

const now = Math.floor((Date.now() / 1000));
const alg = 'ES256';
const headers = {
    'alg': alg,
    'kid': ''
}
// Exp is set to now + 6 months
// which is the max time allowed for a 
// jwt to exist for the Apple Music API.
// Change 15777000 to something else
// if you want it to expires sooner.
const payload = {
    'iss': '',
    'exp': now + 15777000,
    'iat': now
}

let privateKey;
let dataReady = false;

// You can configure your teamID and Key ID 
// by adding a .env file to this directory 
// and setting TEAM_ID and KEY_ID
// the pass your .p8 private key path in as an 
// argument to `npm run generate`

main().catch(console.error);

async function main() {

    if (!process.env.TEAM_ID) {
        throw new Error('TEAM_ID is not set in .env file');
    }
    if (!process.env.KEY_ID) {
        throw new Error('KEY_ID is not set in .env file');
    }
    if (!process.argv[2]) {
        throw new Error('Pass path to secret key file as an argument');
    }

    privateKey = fs.readFileSync(process.argv[2]);
    payload.iss = process.env.TEAM_ID;
    headers.kid = process.env.KEY_ID;
    dataReady = true;

    // JWT are formed formed like:
    // jwt.sign(payload, secretOrPrivateKey, [options, callback])
        jwt.sign(payload, privateKey, {header: headers}, async function (error, token) {
            if (error) {
                console.error(error);
                process.exit(1);
            }

            if (!VALIDATE_TOKEN) {
                SAVE_TO_FILE ? writeToFile('token.jwt', token) : console.log(token);
                process.exit(0);
            }

            console.log("Testing token... \n")
            // test generated token against Apple Music API...
            let url = 'https://api.music.apple.com/v1/catalog/ca/genres';
            if (process.argv.indexOf('--test') > -1) {
                url = 'https://api.music.apple.com/v1/test';
            }
            await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
                .then(response => {
                    // Catch test error and stop
                    if (response.status == 401) {
                        console.log('401');
                        console.log('The generated token is unauthorized to access the Apple Music API');
                        process.exit(1);
                    } else if (response.status == 429) {
                        if (process.argv.indexOf('--test') > -1) {
                            console.log('✅ Test passed');
                            process.exit(0);
                        } else {
                            console.log('The generated token was rejected by the Apple Music API.');
                            console.log(`Status: ${response.status} Message: ${response.statusText}`);
                            process.exit(1);
                        }
                    }
                    return response.json();
                })
                .then(json => {
                    if (json) {
                        console.log('✅ Test passed');
                    } else {
                        console.log('❌ Test failed');
                        console.log('The JWT was generated but there was an error when it was presented ')
                    }
                    // Save the generated to token to a jwt file in the current directory
                    // or log to console.
                    SAVE_TO_FILE ? writeToFile('token.jwt', token) : console.log(token);
                })
                .catch(error => {
                    console.error(error);
                })
        });
}


// Define writeToFile function
function writeToFile(fileName, data) {
    fs.writeFileSync(fileName, data);
}

/*
 * File: controller.js
 * Project: steam-idler
 * Created Date: 2022-10-17 18:00:31
 * Author: 3urobeat
 *
 * Last Modified: 2023-12-31 12:24:21
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 - 2023 3urobeat <https://github.com/3urobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Handles creating bot objects, providing them with data and relogging
const fs = require("fs");
const logger = require("output-logger");
const Bot = require("./bot.js");
const allBots = [];

// Export both values to make them accessable from bot.js
module.exports.nextacc = 0;
module.exports.relogQueue = []; // Queue tracking disconnected accounts to relog them after eachother with a delay

// Configure my logging lib
logger.options({
    msgstructure: `[${logger.Const.ANIMATION}] [${logger.Const.DATE} | ${logger.Const.TYPE}] ${logger.Const.MESSAGE}`,
    paramstructure: [logger.Const.TYPE, logger.Const.MESSAGE, "nodate", "remove", logger.Const.ANIMATION],
    outputfile: "./output.txt",
    exitmessage: "Goodbye!",
    printdebug: true
});

/**
 * Helper function to import login information from accounts.txt
 * @returns {Promise} data array on success, Promise rejected in case of failure
 */
function readFileAsync(filename) {
    logger("info", "Loading logininfo from accounts.txt...");
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, "utf8").split("\n");
            resolve(data);
        } else {
            logger("error", "No accounts found in accounts.txt! Aborting...");
            reject(new Error("No accounts found in accounts.txt"));
        }
    });
}

/**
 * Helper function to process data from readFileAscyn
 * @param {string[]} data - Array of lines from the file
 * @returns {Promise} loginInfo object on success, Promise rejected in case of failure
 */
function processFileData(data) {
    return new Promise((resolve, reject) => {
        try {
            let loginInfo = {};

            data.forEach((line, index) => {
                if (line.length < 2) return;    // Ignore empty or near-empty lines

                const parts = line.split(";");
                if (parts.length < 2) {
                    logger("warn", `Line ${index + 1} is malformed: "${line}"`);
                    return; // Skip malformed lines
                }

                const [accountName, password, sharedSecret = null, proxy = null] = parts;
                loginInfo[accountName] = {
                    accountName: accountName,
                    password: password,
                    sharedSecret: sharedSecret,
                    steamGuardCode: null,
                    proxy: proxy ? proxy.replace("\r", "") : null
                };
            });

            logger("info", `Found ${Object.keys(loginInfo).length} accounts in accounts.txt.`, false, true, logger.animation("loading"));
            resolve(loginInfo);
        } catch (error) {
            logger("error", `Failed to process file data: ${error.message}`);
            reject(error);
        }
    });
}

/* ------------ Login all accounts ------------ */
module.exports.start = async () => {
    global.logger = logger; // Make logger accessible from everywhere in this project

    logger("", "", true, true);
    logger("info", "steam-idler by 3urobeat v1.9\n");

    try {
        const data = await readFileAsync('accounts.txt');
        const info = await processFileData(data);

        logger("", "", true);

        Object.values(info).forEach((loginInfo, index) => {
            setTimeout(() => {
                const readycheckinterval = setInterval(() => {
                    if (this.nextacc === index) { // Check if it is our turn
                        clearInterval(readycheckinterval);

                        try {
                            // Create new bot object
                            const bot = new Bot(loginInfo, index, loginInfo.proxy);
                            bot.login();
                            allBots.push(bot);
                        } catch (error) {
                            console.error(`Failed to initialize bot for account at index ${index}:`, error);
                        }
                    }
                }, 250);
            }, index * 1000);
        });
    } catch (error) {
        logger("error", `Error starting bots: ${error.message}`);
    }
};

// Log playtime for all accounts on exit
process.on("exit", () => {
    allBots.forEach((bot) => {
        try {
            bot.logPlaytimeToFile();
        } catch (error) {
            console.error("Error logging playtime for a bot:", error);
        }
    });
});

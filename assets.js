"use strict";

const fetch = require("node-fetch");
const jsdom = require("jsdom");
const config = require("./config");
const { JSDOM } = jsdom;

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function debugLog(...args){
    if(!config.debug?.sendDebugLogs) return;
    console.log("[DEBUG]",...args);
}

/**
 * Extract form data from a Google Form HTML page.
 * @param {string} formUrl - The URL of the Google Form.
 * @returns {Promise<{fbzx: string, fbPublicLoadData: object}>} - JSON containing fbzx and fbPublicLoadData.
 */
async function extractFormData(formUrl) {
    try {
        const response = await fetch(formUrl);
        const html = await response.text();

        const dom = new JSDOM(html);
        const document = dom.window.document;

        const scripts = Array.from(document.querySelectorAll("script"));
        let fbPublicLoadData = null;
        let fbzx = null;

        for (let script of scripts) {
            if (script.textContent.includes("FB_PUBLIC_LOAD_DATA_")) {
                fbPublicLoadData = JSON.parse(
                    script.textContent.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);/)[1]
                );
                break;
            }
        }

        const formElement = document.querySelector("form[data-shuffle-seed]");
        fbzx = formElement ? formElement.getAttribute("data-shuffle-seed") : null;

        if (!fbPublicLoadData) {
            throw new Error("Failed to extract FB_PUBLIC_LOAD_DATA");
        }
        if (!fbzx) {
            throw new Error("Failed to extract fbzx (data-shuffle-seed)");
        }

        return { fbzx, fbPublicLoadData };
    } catch (error) {
        console.error("Error extracting form data:", error);
        throw error;
    }
}

/**
 * Generate a request body for the form submission.
 * @param {object} fbPublicLoadData - The extracted form data.
 * @returns {string} - The formatted request body.
 */
function generateRequestBody(fbzx,fbPublicLoadData) {
    const pageHistory = [0];
    let sectionCounter = 0;
    const formBody = [];
    const questions = fbPublicLoadData[1][1];
    const fillOutWithEmail = fbPublicLoadData[1][10][6] === 3;


    for (let question of questions) {

        const questionType = question[3];
        if([6,11].includes(questionType)) {
            debugLog(`[Skipping Question] ID:`, question[0], questionType);
            continue;
        }
        const entryId = question[4]?.[0]?.[0];
        if(!entryId && questionType !== 8 && questionType !== 7){
            console.error(`Entry ID missing! (Question Type=${questionType})`);
            console.error(`Error Filling Out Form: Most likely protected by Google account verification.`)
            process.exit();
        }
        const questionValidation = question[4]?.[0]?.[4]?.[0] ?? null;
        


        switch (questionType) {
            case 0: // Short answer
            case 1: // Long answer (paragraph)
                debugLog("Question Validation Info:", questionValidation);
                const stringAnswer = generateStringResponse(questionType);
                if(questionValidation){
                    const validationType = questionValidation[0];
                    const validationSubType = questionValidation[1];
                    const validationQuery = questionValidation[2]?.[0] ?? null;

                    switch(validationType){
                        case 1: //Number
                            const numberValidationQuery = parseInt(validationQuery ?? 1);
                            switch(validationSubType){
                                case 1:
                                case 2:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent((numberValidationQuery+1).toString())}`);
                                    debugLog(`Filled out string entry with a number (${numberValidationQuery+1})`);
                                    break;
                                case 3:
                                case 4:
                                case 8:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent((numberValidationQuery - 1).toString())}`);
                                    debugLog(`Filled out string entry with a number (${numberValidationQuery - 1})`);
                                    break;
                                case 5:
                                case 7:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent((numberValidationQuery).toString())}`);
                                    debugLog(`Filled out string entry with a number (${numberValidationQuery})`);
                                    break;
                                case 6:
                                    const randomAnswer = numberValidationQuery + ~~(Math.random() * 50);
                                    formBody.push(`entry.${entryId}=${encodeURIComponent((randomAnswer).toString())}`);
                                    debugLog(`Filled out string entry with a number (${randomAnswer})`);
                                    break;
                                case 9:
                                case 10:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent((~~(Math.random() * 50)).toString())}`);
                                    debugLog(`Filled out string entry with a random number`);
                                    break
                                default:
                                    console.error(`No handling for Number question validation! (validationType=${validationType})`);
                                    break;
                            }
                            break;
                        case 2: //Text
                            switch(validationSubType){
                                case 100:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(`${validationQuery} || ${stringAnswer}`)}`);
                                    debugLog(`Filled out string entry with a modified string`);
                                    break;
                                case 101:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(stringAnswer.replaceAll(validationQuery,""))}`);
                                    debugLog(`Filled out string entry with a modified string`);
                                    break;
                                case 102:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(config.answers.emailAnswer)}`);
                                    debugLog(`Filled out string entry with an email`);
                                    break;
                                case 103:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(config.answers.urlAnswer)}`);
                                    debugLog(`Filled out string entry with a URL`);
                                    break;
                            }
                            break;
                        case 6: //Length
                            const lengthValidationQuery = parseInt(validationQuery ?? 1);    
                            switch (validationSubType) {
                                case 202:
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(stringAnswer.substring(0,lengthValidationQuery))}`);
                                    debugLog(`Filled out string entry with a shortened answer`);
                                    break;
                                case 203:
                                    const lengthDiff = stringAnswer.length - lengthValidationQuery;
                                    const extraChars = (lengthDiff > 0) ? generateRandomString(lengthDiff) : "";
                                    formBody.push(`entry.${entryId}=${encodeURIComponent(`${stringAnswer} | ${extraChars}`)}`);
                                    debugLog(`Filled out string entry with a random string at the end`);
                                    break;
                            }
                            break;
                        case 4:
                            console.error(`No handling for RegExp question validation!`);
                            break;
                        default:
                            console.error(`Unknown validation type: ${validationType}`);
                            break;
                    }

                    break;
                }
                formBody.push(`entry.${entryId}=${encodeURIComponent(stringAnswer)}`);
                debugLog(`Filled out string entry (type=${questionType})`);
                break;
            case 18:
            case 3:
            case 5:
            case 2:
                const choiceOptions = question[4][0][1];
                const randomChoice = ~~(Math.random() * choiceOptions.length);
                const choice = choiceOptions[randomChoice][0];

                debugLog(`Selected random multiple choice answer[type=${questionType}]: ${choice}`);
                formBody.push(`entry.${entryId}=${encodeURIComponent(choice)}`);
                break;
            case 4:
                const choices = question[4][0][1];
                let selectedChoiceAmt = 0;
                debugLog("Question Validation Info:", questionValidation);
                
                if (questionValidation) {
                    const validationSubType = questionValidation[1];
                    const validationQuery = questionValidation[2]?.[0] ?? null;
                    const numberValidationQuery = parseInt(validationQuery);

                    switch(validationSubType){
                        case 204:
                        case 200:
                            for (let i = 0; i < choices.length; i++) {
                                if (selectedChoiceAmt < numberValidationQuery) {
                                    selectedChoiceAmt++;
                                    debugLog(`Selected checkbox option (${i+1}/${choices.length})(t=${selectedChoiceAmt})`);
                                    selectCheckboxAnswer(formBody, entryId, question, i,choices);
                                }
                            }
                        break;
                        case 201:
                            for (let i = 0; i < choices.length; i++) {
                                if ((Math.random() > 0.5) || ((selectedChoiceAmt < numberValidationQuery) && (i === choices.length - 1))) {
                                    selectedChoiceAmt++;
                                    debugLog(`Selected checkbox option (${i+1}/${choices.length})(t=${selectedChoiceAmt})`);
                                    selectCheckboxAnswer(formBody, entryId, question, i, choices);
                                }
                            }
                        break;
                    }
                    break;
                }

                for (let i = 0; i < choices.length; i++) {
                    if ((Math.random() > 0.5) || ((selectedChoiceAmt === 0) &&  (i === choices.length -1)) ) {
                        selectedChoiceAmt++;
                        debugLog(`Selected checkbox option (${i + 1}/${choices.length})(t=${selectedChoiceAmt})`);
                        selectCheckboxAnswer(formBody, entryId, question, i, choices);
                    }
                }
                break;
            case 8:
                pageHistory.push(++sectionCounter);
                break;
            case 9:
                const needsTime = question[4][0][7][0] === 1;

                if (needsTime) {
                    const randomHour = ~~(Math.random() * 25);
                    const randomMinute = ~~(Math.random() * 60);

                    formBody.push(`entry.${entryId}_hour=${encodeURIComponent(randomHour)}`);
                    formBody.push(`entry.${entryId}_minute=${encodeURIComponent(randomMinute)}`);

                    debugLog(`Generated a random time: ${randomHour} hour(s), ${randomMinute} minute(s)`);
                }

                const randomYear = ~~(Math.random() * 10000);
                const randomMonth = ~~(Math.random() * 12) + 1;
                const randomDay = randomMonth === 2 ? ~~(Math.random() * 28) + 1  : ~~(Math.random() * 30) + 1;

                formBody.push(`entry.${entryId}_year=${encodeURIComponent(randomYear)}`);
                formBody.push(`entry.${entryId}_month=${encodeURIComponent(randomMonth)}`);
                formBody.push(`entry.${entryId}_day=${encodeURIComponent(randomDay)}`);

                debugLog(`Generated a random date: Year ${randomYear}, Month ${randomMonth}, Day ${randomDay}`);
                break;
            case 10:
                const randomHour = ~~(Math.random() * 25);
                const randomMinute = ~~(Math.random() * 60);

                formBody.push(`entry.${entryId}_hour=${encodeURIComponent(randomHour)}`);
                formBody.push(`entry.${entryId}_minute=${encodeURIComponent(randomMinute)}`);

                debugLog(`Generated a random time: ${randomHour} hour(s), ${randomMinute} minute(s)`);
                break;
            case 7:
                debugLog(`[Skipping Question] Grid question (type=${questionType}) ID:`, question[0]);
                break;
            default:
                console.warn(`Unsupported question type: ${questionType}`);
                process.exit();
        }
    }

    if (fillOutWithEmail) formBody.push(`emailAddress=${encodeURIComponent(config.answers.emailAnswer)}`);
    
    formBody.push(`fvv=1`);
    formBody.push(`partialResponse=%5Bnull%2Cnull%2C%22${encodeURIComponent(fbzx)}%22%5D`);
    formBody.push(`pageHistory=${encodeURIComponent(pageHistory.join(","))}`);
    formBody.push(`fbzx=${encodeURIComponent(fbzx)}`);
    formBody.push(`submissionTimestamp=${Date.now()}`);
    

    return formBody.join("&");
}

function selectCheckboxAnswer(formBody, entryId, question, iteration, choices){
    const isOtherOption = question[4][0][1][iteration][4] === 1;
    if(isOtherOption){
        const stringAnswer = generateStringResponse(0);
        formBody.push(`entry.${entryId}.other_option_response=${encodeURIComponent(stringAnswer)}`);
        formBody.push(`entry.${entryId}=${encodeURIComponent("__other_option__")}`);
        debugLog(`Selected checkbox OTHER option (${iteration + 1}/${choices.length})`);
    }
    else formBody.push(`entry.${entryId}=${encodeURIComponent(choices[iteration][0])}`);
}

function generateStringResponse(questionType) {
    if (![0, 1].includes(questionType)) questionType = 0;
    return config.answers[questionType] || "";
}

async function submitForm(formUrl, fbzx, requestBody) {
    try {
        const submitResponse = await fetch(formUrl.replace("/viewform", "/formResponse"), {
            credentials: "include",
            headers: {
                "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-CA,en-US;q=0.7,en;q=0.3",
                "Content-Type": "application/x-www-form-urlencoded",
                "Sec-GPC": "1",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
                "Priority": "u=0, i"
            },
            referrer: `${formUrl}?fbzx=${fbzx}`,
            method: "POST",
            mode: "cors",
            body: requestBody
        });

        return submitResponse;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    extractFormData,
    generateRequestBody,
    submitForm,
    debugLog
};
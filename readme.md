## About this project
This is a Gmail Add-on that can trigger on compose, that allow users to search Giphy and insert it to current draft.

## Build and deploy
The repository uses NPM and Webpack together with Apps Script. All NPM package related function should be put into file `./src/lib.js`, and properly export.

To build, run `npm run build`, which will only compile `./src/lib.js` and copy other necessary files to `./dist` folder.

To deploy, create a project by `clasp create` and then run `npm run deploy`, which will push local change to Apps Script project.

## APIs used

### Giphy API
See [official documentation](https://developers.giphy.com/docs/api#quick-start-guide) for Giphy API.

### Gmail API
Apps Script has its built-in [GmailApp](https://developers.google.com/apps-script/reference/gmail/gmail-app) class that serves as API to Gmail service. Some of the class methods require accessToken, which is passed in the contxtual triggered event object of Gmail Add-on. However, this project uses compose trigger that has no accessToken passed. Therefore it has to use [Gmail API](https://developers.google.com/gmail/api/v1/reference) instead.

## Challenges and improvements to be done
There are challenges that require further investigation.

First, inserting giphy gif into draft message is done by `PUT` request to `Gmail API`. This process takes several seconds or longer, and user has to exit & re-open draft to see the change, which is far from a good user experience. Desired behavior would be 1) showing sycing UI while waiting for the response and 2) refresh the draft message automatically when done. 1) could be resolved by switching between different UI cards, while 2) could be tricky, as the original message in currently opened draft would be deleted in PUT request, and it must refresh the draft to show the new message, which is not supported directly in Gmail API. 

Second, gif cannot be inserted separately into the message via Gmail API. Instead, a whole new message payload must be provided to the `PUT` request, and replacing the old message as a whole. Therefore, it's necessary to extract the message content as well as metadata from the old message, to fabricate the payload for new message. Current code replicates the message meta and content but not the original attachments, where more work is to be done.

There are also UI improvements that could be done, such as adding more specific error handling card.


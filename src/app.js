function showUI(e){
	var searchCard = buildSearchCard(e);
  return [searchCard];
}

function buildSearchCard(e, status){
  var section = CardService.newCardSection()
    .setHeader("<font color=\"#1257e0\"><b>Search your giphy</b></font>")

	var searchInput = CardService.newTextInput()
    .setTitle("search keyword")
    .setFieldName("q")
  section.addWidget(searchInput)

  var textInput = CardService.newTextInput()
    .setTitle("api key from Giphy API")
    .setFieldName("api_key")
  section.addWidget(textInput);

  var tp = CardService.newTextParagraph()
    .setText("To get api key, register at <a href=\"https://developers.giphy.com/docs/sdk\">here</a>.");
  section.addWidget(tp);

  var btnAction = CardService.newAction().setFunctionName('searchGiphy');
  var btn = CardService.newTextButton()
    .setText("Search")
    .setOnClickAction(btnAction);
  var resetAction = CardService.newAction().setFunctionName('resetCard');
  var resetBtn = CardService.newTextButton()
    .setText("Clear")
    .setOnClickAction(resetAction);
  var btnGroup = CardService.newButtonSet()
    .addButton(resetBtn)
    .addButton(btn)
  section.addWidget(btnGroup);

  if(status === 'failure'){
    var failureNotice = CardService.newTextParagraph()
      .setText("<font color='#f50525'>An error occurred, please try again later.</font>");
    section.addWidget(failureNotice);
  }

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Find your favorite giphy')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png')
    )
    .addSection(section)
    .build();
  return card;	
}

function searchGiphy(e){
  var apiKey = e.formInputs.api_key[0];
  var queryString = e.formInputs.q[0];
  var endpoint = 'https://api.giphy.com/v1/gifs/search?api_key=' + apiKey + '&q=' + queryString;
  var response = UrlFetchApp.fetch(endpoint, {muteHttpExceptions: true});
  if(response.getResponseCode() === 200){
    var content = JSON.parse(response.getContentText());
    return showRequestSuccessCard(content, queryString);
  }
  else{
    console.log(response.getResponseCode(), response.getContentText())
    return showRequestFailureCard(e);
  }
}

function showRequestSuccessCard(content, queryString){
  var section = CardService.newCardSection();
  for(var i=0; i<content['data'].length; i++){
    var type = content['data'][i]['type'];
    var imageUrl;
    if(type === 'gif'){
      imageUrl = content['data'][i]['images']['480w_still']['url'];
    }
    if(imageUrl){
      var onClickGiphyAction = CardService.newAction()
        .setFunctionName('onClickGiphy')
        .setParameters({'gifUrl': content['data'][i]['images']['downsized']['url']});
      var image = CardService.newImage()
        .setAltText(content['data'][i]['title'])
        .setImageUrl(imageUrl)
        .setOnClickAction(onClickGiphyAction);
      section
        .addWidget(image)
    }
  }
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Search results: ' + queryString)
    )
    .addSection(section)
    .build();
  // navigation
  var navigation = CardService.newNavigation().pushCard(card);
  return CardService.newActionResponseBuilder().setNavigation(navigation).build();
}

function onClickGiphy(e){
  // https://ctrlq.org/code/20133-create-gmail-drafts-attachments
  // get original draft message
  try{
    var draft = GmailApp.getDrafts()[0];
    var draftId = draft.getId();
    var messageId = draft.getMessageId();
    var oldMessage = getMessageFromId(messageId);

    // get image blob from url
    var imgUrl = e.parameters.gifUrl;
    var imgAttachment = getImgAttachment(imgUrl, true);

    // insert the image blob as attachment and create new draft using info from old draft message
    var newMessage = addImgAttToOldMessage(oldMessage, imgAttachment);
    var resp = updateDraft(draftId, newMessage);
    var respJson = JSON.parse(resp.getContentText());

    // TODO, add UI handler
    if(resp.getResponseCode() === 200){ 
    }
    else{
    }
  }
  catch(e){
    console.log(e);
    showRequestFailureCard(e);
  }
}

function getMessageFromId(messageId){
  var params = {
    method:"get",
    contentType: "application/json",
    headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
    muteHttpExceptions:true
  };
  var resp = UrlFetchApp.fetch("https://www.googleapis.com/gmail/v1/users/me/messages/"+messageId, params);
  var respContent = JSON.parse(resp.getContentText());
  if(resp.getResponseCode() === 200){
    return respContent;
  }
  else{
    showRequestFailureCard();
  }
}

/* convert image url to properly formatted attachment object
  @params {string} imgUrl
*/
function getImgAttachment(imgUrl, isInline) {
  var imgBlob = UrlFetchApp.fetch(imgUrl).getBlob().setName("inlineImgBlob");
  var fileId = AppLib.createUUID();
  var att = {
    mimeType: "image/gif",
    fileName: "giphy-" + fileId + ".gif",
    bytes: Utilities.base64Encode(imgBlob.getBytes())
  };
  // to make image inline, must attach content id header
  // https://stackoverflow.com/questions/24461133/can-you-and-how-do-you-embed-images-in-an-email-when-using-the-gmail-api
  if(isInline){
    att['contentId'] = fileId;
  }
  return att;
}

/* make a new message object based on given message, and attach the given image of gif format
*/
function addImgAttToOldMessage(messageContent, imgAttachment){
  // extract "from" and "to" from original message
  var temp = messageContent.payload.headers.filter(function(el){if(el.name === 'To'){return el;}});
  var to;
  if(temp.length > 0){
    to = {
      name: temp[0].name,
      email: temp[0].value.split('>')[0]
    }
  }
  var from;
  temp = messageContent.payload.headers.filter(function(el){if(el.name === 'From'){return el;}});
  if(temp.length > 0){
    from = {
      name: temp[0].name,
      email: temp[0].value.split('>')[0]
    }
  }

  // extract subject line
  var sl = messageContent.payload.headers.filter(function(e){if(e.name==='Subject'){return e}})[0];
  if(sl){
    sl = sl.value;
  }

  // extract body text and html
  var bodyTextParts = findPartByMimeType(messageContent.payload.parts, 'text/plain');
  var bodyHtmlParts = findPartByMimeType(messageContent.payload.parts, 'text/html');
  var bodyHtmlDecoded = '', bodyText;
  var bodyHtmlStr = '', bodyHtml;
  if(bodyHtmlParts.length > 0){
    bodyHtmlDecoded = Utilities.base64DecodeWebSafe(bodyHtmlParts[0].body.data);
    bodyHtmlStr = String.fromCharCode.apply(null, bodyHtmlDecoded);
  }
  var bodyTextDecoded = '';
  var bodyTextStr = '';
  if(bodyTextParts.length > 0){
    bodyTextDecoded = Utilities.base64DecodeWebSafe(bodyTextParts[0].body.data);
    bodyTextStr = String.fromCharCode.apply(null, bodyTextDecoded);
  }
  // add inline image
  // // https://stackoverflow.com/questions/24461133/can-you-and-how-do-you-embed-images-in-an-email-when-using-the-gmail-api
  if(imgAttachment.contentId){
    bodyHtmlStr += '<img src="cid:' + imgAttachment.contentId + '"/>';
  }
  // extract original attchments
  var attachments = [];

  //   // TODO - pending debug
  // var attParts = [];
  // for(var i=0; i<messageContent.payload.parts.length; i++){
  //   var part = messageContent.payload.parts[i];
  //   if(part.filename && part.filename !== ''){
  //     attParts.push(part);
  //   }
  // }
  // for(var i=0; i<attParts.length; i++){
  //
  //   // get previous attachment and convert to blob
  //   // https://stackoverflow.com/questions/33812718/how-to-download-attachment-from-gmail-api-using-javascript
  //   var messageId = messageContent.id;
  //   var attRes = UrlFetchApp.fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + messageId + '/attachments/' + attParts[i].body.attachmentId, {muteHttpExceptions: true});
  //   if(attRes.getResponseCode() === 200){
  //     var mimeType = attRes.mimeType;
  //     var attachment = attRes.attachment;
  //     var attDataBase64Rep = attRes.data.replace(/-/g, '+').replace(/_/g, '/');
  //     var attblob = b64toBlob(attDataBase64Rep, mimeType, attachment.size)
  //     // var attBlob = attRes.getBlob();
  //     attachments.push({
  //       mimeType: attParts[i].mimeType,
  //       fileName: attParts[i].filename,
  //       bytes: Utilities.base64Encode(attBlob.getBytes())
  //     });
  //   }
  // }

  // add image attachment
  if(imgAttachment){
    attachments.push(imgAttachment);
  }
  // construct message payload
  var message = {
    to: to,
    from: from,
    body: {
      text: bodyTextStr,
      html: bodyHtmlStr
    },
    subject: sl,
    files: attachments
  };
  return message;
}

function findPartByMimeType(parts, targetType){
  var res = [];
  if(!parts || parts.length === 0){
    return res;
  }
  for(var i=0; i<parts.length; i++){
    if(parts[i].mimeType === targetType){
      res.push(parts[i]);
    }
    else if(parts[i].parts){
      var temp = findPartByMimeType(parts[i].parts, targetType);
      res = res.concat(temp);
    }
  }
  return res;
}

// Create a MIME message that complies with RFC 2822
function createMimeMessage(msg) {
  var nl = "\n";
  var boundary = "__ctrlq_dot_org__";

  var mimeBody = [ "MIME-Version: 1.0"];
  if(msg.to){
    mimeBody.push("To: " + encode(msg.to.name) + "<" + msg.to.email + ">");
  }
  if(msg.from){
    mimeBody.push("From: " + encode(msg.from.name) + "<" + msg.from.email + ">");
  }
  if(msg.subject){
    mimeBody.push("Subject: " + encode(msg.subject));
  }
  mimeBody.push("Content-Type: multipart/alternative; boundary=" + boundary + nl,
    "--" + boundary);
  mimeBody.push("Content-Type: text/plain; charset=UTF-8");
  mimeBody.push("Content-Transfer-Encoding: base64" + nl);
  if(msg.body.text){
    mimeBody.push(Utilities.base64Encode(msg.body.text, Utilities.Charset.UTF_8) + nl,
    "--" + boundary);
  }
  mimeBody.push("--" + boundary);
  mimeBody.push("Content-Type: text/html; charset=UTF-8");
  mimeBody.push("Content-Transfer-Encoding: base64" + nl);
  if(msg.body.html){
    mimeBody.push(Utilities.base64Encode(msg.body.html, Utilities.Charset.UTF_8) + nl)
  }

  for (var i = 0; i < msg.files.length; i++) {
    var attachment = ["--" + boundary];
    if(msg.files[i].contentId){
      attachment.push("Content-Id: <" + msg.files[i].contentId+ ">");
    }
    attachment = attachment.concat([
      "Content-Type: " + msg.files[i].mimeType + '; name="' + msg.files[i].fileName + '"',
      'Content-Disposition: attachment; filename="' + msg.files[i].fileName + '"',
      "Content-Transfer-Encoding: base64" + nl,
      msg.files[i].bytes
    ]);
    mimeBody.push(attachment.join(nl));
  }

  mimeBody.push("--" + boundary + "--");

  return mimeBody.join(nl);
}

/* create new draft given payload
*/
function createDraft(message) {
  var payload = createMimeMessage(message);
  var response = UrlFetchApp.fetch(
    "https://www.googleapis.com/upload/gmail/v1/users/me/drafts?uploadType=media", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + ScriptApp.getOAuthToken(),
        "Content-Type": "message/rfc822",
      },
      muteHttpExceptions: true,
      payload: payload
    });
  return response;
}

/* create new draft given payload
*/
function updateDraft(draftId, message) {
  var payload = createMimeMessage(message);
  var response = UrlFetchApp.fetch(
    "https://www.googleapis.com/upload/gmail/v1/users/me/drafts/" + draftId + "?uploadType=media", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + ScriptApp.getOAuthToken(),
        "Content-Type": "message/rfc822",
      },
      muteHttpExceptions: true,
      payload: payload
    });
  return response;
}

// UTF-8 characters in names and subject
function encode(subject) {
  var enc_subject = Utilities.base64Encode(subject, Utilities.Charset.UTF_8);
  return '=?utf-8?B?' + enc_subject + '?=';
}

function b64toBlob(b64Data, contentType, sliceSize) {
  contentType = contentType || '';
  sliceSize = sliceSize || 512;

  var byteCharacters = atob(b64Data);
  var byteArrays = [];

  for(var offset = 0; offset < byteCharacters.length; offset += sliceSize){
    var slice = byteCharacters.slice(offset, offset + sliceSize);
    var byteNumbers = new Array(slice.length);
    for (var i = 0; i < slice.length; i++){
      byteNumbers[i] = slice.charCodeAt(i);
    }
    var byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  var blob = new Blob(byteArrays, {type: contentType});
  var urlBlob = URL.createObjectURL(blob);
  return urlBlob;
}




function showRequestFailureCard(e){
  var navigation = CardService.newNavigation().updateCard(buildSearchCard(e, 'failure'));
  return CardService.newActionResponseBuilder().setNavigation(navigation).build();
}

function resetCard(e){
  var navigation = CardService.newNavigation().updateCard(buildSearchCard(e));
  return CardService.newActionResponseBuilder().setNavigation(navigation).build();
}

function showAbout(e){
  var tp = CardService.newTextParagraph()
    .setText("Open a compose or reply window and start to search & insert your favorite giphy to mail!");
  var section = CardService.newCardSection()
    .addWidget(tp);
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('About Giphy Mail')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png')
    )
    .addSection(section)
    .build();
  return [card];
}
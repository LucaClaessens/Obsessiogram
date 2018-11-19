// Enable chromereload by uncommenting this line:
// import 'chromereload/devonly'

let config = {
  debounceDuration: 100
}

let lastInterceptedRequest = 0;

chrome.runtime.onInstalled.addListener((details) => {
  console.log('previousVersion', details.previousVersion);
});

chrome.runtime.onMessage.addListener(
  function(req, sender, sendResponse) {
    console.log(req);
    if (req.videoId){
      const url = "https://us-central1-obsessiogram.cloudfunctions.net/changeVideo";
      return fetch(url, {
        method: 'post',
        body: `${req.videoId}`
      }).then(done => {
        console.log('message sent to cloud function.');
        return true;
      })
    }
  });

  var onHeadersReceived = function(details) {
  
    for (var i = 0; i < details.responseHeaders.length; i++) {
      if ('content-security-policy' === details.responseHeaders[i].name.toLowerCase()) {
        details.responseHeaders[i].value = '';
      }
    }
  
    return {
      responseHeaders: details.responseHeaders
    };
  };

var filter = {
  urls: ["*://*/*"]
};

chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter, ["blocking", "responseHeaders"]);

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if(+new Date - config.debounceDuration > lastInterceptedRequest ){
      lastInterceptedRequest = +new Date;

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {trigger: "listenForPost"}, function(response) {
          console.log('received response');
        });
      });
    }

  },
  {urls: ["https://upload.facebook.com/*"]});
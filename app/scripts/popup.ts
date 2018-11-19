// Enable chromereload by uncommenting this line:
// import 'chromereload/devonly'

console.log(`This is the popup`);
var form = document.querySelector('form');
const duration = document.querySelector('#duration');
const scrollticks = document.querySelector('#scrollticks');
const likecount = document.querySelector('#likecount');
const commentcount = document.querySelector('#commentcount');
const webcamtime = document.querySelector('#webcamtime');
const fakemovement = document.querySelector('#fakemovement');

form.addEventListener("submit", savePreferences);

document.addEventListener('DOMContentLoaded', e => {
    chrome.storage.local.get(['duration', 'scrollticks','likecount','commentcount', 'webcamtime', 'fakemovement'], (items) => {
        
        console.log('loaded',items);

        duration.value = items.duration / 1000 || 15;
        scrollticks.value = items.scrollticks || 300;
        likecount.value = items.likecount || 6;
        commentcount.value = items.commentcount || 5;
        webcamtime.value = items.webcamtime / 1000 || 30;
        fakemovement.checked = items.fakemovement || true;

        if(!items || Object.keys(items).length === 0){
            return savePreferences(false);
        }

    })
}, false);

// offsetBoundary: 300,
// measureDuration: 15000,
// likeCount: 6,
// commentCount: 5

function savePreferences(e: any){
    if (e && e.preventDefault) e.preventDefault();
    
    const formdata: any = {};
    formdata.duration = duration.value * 1000 || 15000;
    formdata.scrollticks = +scrollticks.value || 300;
    formdata.likecount = +likecount.value || 6;
    formdata.commentcount = +commentcount.value || 5;
    formdata.webcamtime = +webcamtime.value * 1000 || 30000;
    formdata.fakemovement = fakemovement.checked || true;

    console.log(formdata);

    chrome.storage.local.set(formdata, () => {
        console.log('stored properties');
        window.close();
    });
}
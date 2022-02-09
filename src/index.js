import { test } from "picomatch";
import VideoContext from "videocontext";

let userAssets = {
    'targetImage' : undefined,
    'selectedAudio' : document.querySelector('.audioanchor').src.split('/').slice(-1)[0],
    'audioElement' : document.querySelector('.audioanchor'),
    'imgInfo' : {
        'height' : undefined,
        'width' : undefined
    }
}

const ui = {
    imageGetter: document.getElementById('bg-image-dl'),
    cropForm: document.getElementById('cropParameters'),
    vc: document.getElementById('canvas')
}

let settings = {
    'startingCrop': {
        'xPos' : 0,
        'yPos' : 0,
    },
    'firstBlock' : {
        'xPos' : 0,
        'yPos' : 240,
        'color' : '#000000'
    },
    'kenBurnsSecondCrop' : {
        'xPos' : 0,
        'yPos' : 0
    }
}

ui.imageGetter.addEventListener('change', e => {
    let reader = new FileReader();
    reader.onload = (readerEvent) => {
        var img = new Image();
        img.onload = () => {
            let canvas = document.createElement('canvas'),
                targetWidth = videoSize.x,
                width = img.width,
                height = img.height;

            let newWidth = targetWidth;
            let newHeight = Math.floor((targetWidth / width) * height);

            canvas.width = newWidth;
            canvas.height = newHeight;
            canvas.getContext('2d').drawImage(img, 0, 0, newWidth, newHeight);
            let dataUrl = canvas.toDataURL('image/png');

            userAssets.targetImage = dataUrl;
            userAssets.imgInfo.height = newHeight;
            userAssets.imgInfo.width = newWidth;
            promptForValues();
        }
        img.src = readerEvent.target.result;
    }

    reader.readAsDataURL(ui.imageGetter.files[0])
})

let videoSize = {
    x: 1280,
    y: 720
}

let promptForValues = () => {
    ui.imageGetter.hidden = true;
    ui.imageGetter.parentElement.hidden = true;
    ui.imageGetter.parentNode.hidden = true;
    ui.cropForm.removeAttribute('hidden');
    let preview = document.createElement('img');
    preview.src = userAssets.targetImage;
    preview.height = window.innerHeight * 0.6;
    preview.id = "preview";
    document.querySelector('.preview-holder').appendChild(preview);
    document.querySelector('#preview').addEventListener('click', showPercentage);
    ui.cropForm.onsubmit = ratio;
}

let showPercentage = (event) => {
    let pos_y = event.offsetY ? (event.offsetY): event.pageY - document.getElementById("preview").offsetTop;

    document.querySelector('.preview-indicator').innerHTML = `You clicked at ${Math.round(pos_y / event.target.height * 1000) / 1000}`;
}

let mediaRecorder, recordedChunks;

let ratio = e => {
    e.preventDefault();

    document.addEventListener('onplay', e => {
        console.log(' is playing');
        console.log(e.target);
    });

    document.addEventListener('playing', e => {
        console.log('playing playing');
        console.log(e.target);
    })

    let out = new FormData(ui.cropForm);
    settings.startingCrop.yPos = parseFloat(out.get('startingY'));
    settings.firstBlock.yPos = parseFloat(out.get('blockingY'));
    settings.kenBurnsSecondCrop.yPos = parseFloat(out.get('shiftedY'));
    ui.cropForm.hidden = true;
    ui.vc.removeAttribute('hidden');

    let videoCtx = new VideoContext(ui.vc);

    // var audioNode = videoCtx.audio(userAssets.selectedAudio);
    var audioNode = videoCtx.audio(userAssets.audioElement);
    var imageNode = videoCtx.image(userAssets.targetImage);
    var panner = videoCtx.transition(VideoContext.DEFINITIONS.CROP);
    var superBlocker = videoCtx.transition(VideoContext.DEFINITIONS.AAF_VIDEO_CROP);

    let firstPanAdjusted = settings.kenBurnsSecondCrop.yPos;
    let startingPositionAdjusted = settings.startingCrop.yPos;
    let oldbha = 2 * (settings.firstBlock.yPos - startingPositionAdjusted);
    let blockerHeightAdjusted = -1 + (oldbha /(720 / userAssets.imgInfo.height));

    audioNode.registerCallback('loaded', e => {
        console.log(audioNode.element);
    });

    imageNode.start(0);
    imageNode.stop(9);

    audioNode.start(0);
    audioNode.stop(9);
    
    panner.y = startingPositionAdjusted;
    panner.height = 720 / userAssets.imgInfo.height;
    panner.transition(5.25, 7.25, startingPositionAdjusted, startingPositionAdjusted + firstPanAdjusted, "y");

    superBlocker.cropBottom = blockerHeightAdjusted;
    superBlocker.transition(4, 4.75, blockerHeightAdjusted, 1, "cropBottom");

    imageNode.connect(panner);
    panner.connect(superBlocker);
    superBlocker.connect(videoCtx.destination);
    audioNode.connect(videoCtx.destination);

    console.log(audioNode);
    let ctx = new AudioContext();
    let dest = ctx.createMediaStreamDestination();
    document.querySelectorAll('audio').forEach(audio => {
        let newNode = ctx.createMediaElementSource(audio);
        newNode.connect(dest);
        console.log('connected');
        newNode.connect(ctx.destination);
    });

    let cStream = ui.vc.captureStream(30);
    cStream.addTrack(dest.stream.getAudioTracks()[0]);
    // let ctx = new AudioContext();
    // let dest = ctx.createMediaStreamDestination();
    // let srcNode = ctx.createMediaElementSource(audioNode.element);
    // srcNode.connect(dest);
    // let audioTrack = dest.stream.getAudioTracks()[0];
    // let mixedTrack = new MediaStream([cStream.getVideoTracks()[0], audioTrack]);

    mediaRecorder = new MediaRecorder(cStream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) { recordedChunks.push(e.data); }
    }

    mediaRecorder.start(2000);
    imageNode.registerCallback('ended', () => {
        mediaRecorder.stop();
        setTimeout(() => {
            const blob = new Blob(recordedChunks);
            const url = URL.createObjectURL(blob);
            let exportDiv = document.createElement('a');
            exportDiv.innerHTML = 'Download this!';
            exportDiv.href = url;
            console.log(mediaRecorder.mimeType);
            exportDiv.download = mediaRecorder.mimeType.toLowerCase().includes('matroska') ? `ratio.webm` : `ratio.${mediaRecorder.mimeType.split('/')[1].split(',')[0].split(';')[0]}`;
            document.body.appendChild(exportDiv);
        })
    })

    videoCtx.play();
}


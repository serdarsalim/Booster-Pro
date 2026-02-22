var selectedImage = null;
$("*", document.body).mousedown(function (event) {
    var type;
    switch (event.which) {
        case 1:
            selectedImage = $(this).get(0);
            type = selectedImage.type;
            if (!type || type !== 'application/pdf') {
                selectedImage.style.maxWidth = window.innerWidth;
                selectedImage.style.maxHeight = window.innerHeight;
                selectedImage.style.width = "auto";
                selectedImage.style.height = "auto";
            }

            event.stopImmediatePropagation();
            return false;
            break;
        default:
            break;
    }
});

document.body.style.textAlign = 'center';
chrome.extension.onRequest.addListener(onRequest);


function onRequest(request, sender, sendResponse) {

    function rotateImage(image) {
        var degree;
        if (request.rotation == 'flip') {
            degree = request.angle;
        } else {
            degree = getCurrentRotation(image, request.angle);
        }
        image.style.webkitTransform = 'rotate(' + degree + 'deg)';
    }

    if (selectedImage === null) {
        return;
    } else if (Array.isArray(selectedImage)) {
        $.each(selectedImage, function (i, image) {
            rotateImage(image);
        });
    } else {
        rotateImage(selectedImage);
    }


    sendResponse({}); // clean up.
}

function getCurrentRotation(selectedImage, angle) {
    var currentDegree = selectedImage.style['-webkit-transform'];
    if (currentDeLgree && currentDegree != "") {
        var start = currentDegree.indexOf('(');
        var end = currentDegree.indexOf('deg)');
        angle = parseInt(currentDegree.substring(start + 1, end)) + angle;
    }
    return angle;
}

$(function () {
    selectedImage = Array.prototype.slice.call(document.getElementsByTagName('img')) || null;
});
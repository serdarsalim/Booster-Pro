//Editor: Serdar Domurcuk
// Inspirational music: https://www.youtube.com/watch?v=Rb0UmrCXxVA

var _all;
var numentries;

var newBuildNumber = 280;
setItem("_buildNumber", newBuildNumber);


function updatemenu() {
    chrome.contextMenus.removeAll();

    var searchstring = getItem("_allsearch");

    if (searchstring == null) {
        setItem("_askbg", "true");
        setItem("_asknext", "true");
        _all = new Array(5);

        // 0th item in the array is reserved for context menu item id!!

        _all[0] = new Array(4);
        _all[0][1] = "Search Google"; // Display label
        _all[0][2] = "https://www.google.com/search?sclient=psy-ab&site=&source=hp&btnG=Search&q=%s&oq=&gs_l=&pbx=1"; //Link.. pretty obvious??
        _all[0][3] = true; // whether this option is enabled or not

        _all[1] = new Array(4);
        _all[1][1] = "Google Translate";
        _all[1][2] = "https://translate.google.com/#auto/en/%s";
        _all[1][3] = true;

        _all[2] = new Array(4);
        _all[2][1] = "Search Youtube";
        _all[2][2] = "https://www.youtube.com/results?search_query=%s";
        _all[2][3] = true;

        _all[3] = new Array(4);
        _all[3][1] = "Search Amazon";
        _all[3][2] = "http://www.amazon.com/s/ref=nb_sb_noss?url=search-alias%3Daps&field-keywords=%s";
        _all[3][3] = true;

        _all[4] = new Array(4);
        _all[4][1] = "Search LinkedIn";
        _all[4][2] = "https://www.linkedin.com/vsearch/f?type=all&keywords=%s&orig=GLHD&rsid=&pageKey=oz-winner&trkInfo=&search=Search";
        _all[4][3] = true;


        numentries = _all.length;


        var stringified = JSON.stringify(_all);
        setItem("_allsearch", stringified);
    }
    else {
        _all = JSON.parse(searchstring);

        numentries = _all.length;
    }

    for (var i = 0; i < numentries; i++) {
        if (_all[i][3]) {
            _all[i][0] = chrome.contextMenus.create({
                "title": _all[i][1],
                "contexts": ["link", "selection"],
                "onclick": searchOnClick
            });
            //alert("Menuitem created");
        }
        else _all[i][0] = -1;
    }


}


function searchOnClick(info, tab) {
    var itemindex = 0;
    for (var i = 0; i < numentries; i++) {
        if (info.menuItemId == _all[i][0]) {
            //alert(i);
            itemindex = i;
        }
    }
    var ask_fg = getItem("_askbg") == "true" ? false : true;
    var ask_next = getItem("_asknext") == "true" ? true : false;
    var index = 1000;


    var target = _all[itemindex][2];

    var targetURL = "";


    if (info.linkUrl) {
        targetURL = target
            .replace("SELECTION", info.linkUrl)
            .replace("%s", info.linkUrl);


        var QueryLink = info.linkUrl;


        // Maybe the user selected text. In this case lookout for the selected text!

        targetURL = target
            .replace("SELECTION", info.selectionText)
            .replace("%s", info.selectionText)


        var QueryText = info.selectionText;


        QueryText = QueryText.trim().toLocaleLowerCase();

        // alert(QueryText);
        targetURL = target
            .replace("SELECTION", QueryText)
            .replace("%s", QueryText)


    }

    else {

        // Maybe the user selected text. In this case lookout for the selected text!

        targetURL = target
            .replace("SELECTION", info.selectionText)
            .replace("%s", info.selectionText);


        var QueryText = info.selectionText;


        //Converting the selection to lowercase
        QueryText = QueryText.trim().toLocaleLowerCase();


        // alert(QueryText);
        targetURL = target
            .replace("SELECTION", QueryText)
            .replace("%s", QueryText);


    }


    if (ask_next) {
        chrome.tabs.getSelected(
            null,
            function (tab) {
                index = tab.index + 1;
                chrome.tabs.create({
                    "url": targetURL,
                    "selected": ask_fg,
                    "index": index
                });
            }
        );
    }
    else {
        chrome.tabs.create({
            "url": targetURL,
            "selected": ask_fg
        });
    }

}


updatemenu();


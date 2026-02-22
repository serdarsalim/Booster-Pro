var PAGES_NBR = 2,
    OPTIONS_KEY = "Click-LessOptionsKey";

function requestMenuRefresh() {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({type: "updatemenu"}, function () {
            if (chrome.runtime.lastError) {
                // Ignore if the service worker is unavailable momentarily.
            }
        });
    }
}

function initialise() {
    showpage(1);
    restore_options();
}

function save_import() {
    setItem("_allsearch", document.getElementById("exporttext").value);
    var status = document.getElementById("status_import");
    status.innerHTML = "New Configuration Saved.";
    setTimeout(function () {
        status.innerHTML = "";
    }, 1250);

    requestMenuRefresh();
}

function save_otheroptions() {
    var ask_bg = document.getElementById("ask_bg").checked;
    var ask_next = document.getElementById("ask_next").checked;
    // var ask_gotodomain = document.getElementById("ask_gotodomain").checked
    // var ask_options = document.getElementById("ask_options").checked;


    setItem("_askbg", ask_bg);
    setItem("_asknext", ask_next);
    // setItem("_askgotodomain", ask_gotodomain);
    // setItem("_askoptions", ask_options);
    // setItem("_askoptions", ask_options);

    var status = document.getElementById("status_otheroptions");
    status.innerHTML = "Options Saved.";
    setTimeout(function () {
        status.innerHTML = "";
    }, 1250);

    requestMenuRefresh();
}

function save_options(key) {
    var optionsList = document.getElementById("options_list_ul");
    var maxindex = optionsList.childElementCount;
    var _all = new Array(maxindex);

    for (var i = 0; i < maxindex; i++) {
        curnum = optionsList.children[i].getAttribute('index');
        _all[i] = new Array(3);
        _all[i][0] = "-1";
        _all[i][1] = document.getElementById("listItemName" + curnum).value;
        _all[i][2] = document.getElementById("listItemName" + curnum).getAttribute("title");
        _all[i][3] = document.getElementById("listItemEnab" + curnum).checked;
        //alert(_all[i][3]);
    }

    //alert(_all);
    var stringified = JSON.stringify(_all);
    setItem(key ? key : "_allsearch", stringified);

    var ask_bg = document.getElementById("ask_bg").checked;
    var ask_next = document.getElementById("ask_next").checked;

    setItem("_askbg", ask_bg);
    setItem("_asknext", ask_next);

    var status = document.getElementById("status");

    status.innerHTML = "Options Saved.";
    setTimeout(function () {
        status.innerHTML = "";
    }, 1250);

    requestMenuRefresh();
}

function restore_options(key) {
    var optionsList = document.getElementById("options_list_ul");
    optionsList.innerHTML = "";
    var stringified = getItem(key ? key : "_allsearch");
    document.getElementById("exporttext").value = stringified;
    var parsedArray = JSON.parse(stringified);

    for (var i = 0; i < parsedArray.length; i++) {
        add_item();
    }
    for (var i = 0; i < parsedArray.length; i++) {
        document.getElementById("listItemName" + i).value = parsedArray[i][1];
        document.getElementById("listItemName" + i).setAttribute("title", parsedArray[i][2]);
        if (parsedArray[i][3]) document.getElementById("listItemEnab" + i).checked = "true";
        document.getElementById("listItemRemoveButton" + i).onclick = function (event) {
            index = event.target.getAttribute("index");
            remove(index);
        };
    }

    var ask_bg = getItem("_askbg");
    var ask_next = getItem("_asknext")
    // var ask_options = getItem("_askoptions");

    if (ask_bg == "true") document.getElementById("ask_bg").checked = "true";
    if (ask_next == "true") document.getElementById("ask_next").checked = "true";
    // if (ask_gotodomain == "true") document.getElementById("ask_gotodomain").checked = "true";
    // if (ask_options == "true") document.getElementById("ask_options").checked = "true";
}

function remove(j) {
    var listOfSearchOptions = document.getElementById("options_list_ul");
    var listItemToRemove = document.getElementById("listItem" + j);
    listOfSearchOptions.removeChild(listItemToRemove);
    save_options();
}

function add_item() {
    var optionsList = document.getElementById("options_list_ul");
    var curnum = optionsList.childElementCount;

    var appendListHTML = "<li index='" + curnum + "' id='listItem" + curnum + "'>\
							<div align='center'>\
							<div class='dragIconContainer'>\
							    <div class='dragIcon' title='Drag up or down to rearrange'></div>\
							</div>\
							<input type='text' class='listItemName' id='listItemName" + curnum + "' size='20'; maxlength='30px'>\
							<input type='checkbox' class='checkStyle input-lg' id='listItemEnab" + curnum + "' title='Enabled/Disabled'>\
							<button index=" + curnum + " class='btn btn-danger btn-xs'  id='listItemRemoveButton" + curnum + "' title='Remove'>—</button>\
                                </div></li>"
    document.getElementById("options_list_ul").innerHTML += appendListHTML;

    $(".checkStyle").on("change", function () {
        save_options();
    });

    $(".listItemName").on("change", function () {
        save_options();
    });

    $(".listItemName").on("change", function () {
        save_options();
    });
}


function add_option() {
    var nname = document.getElementById("newname").value;
    var nlink = document.getElementById("newlink").value;

    var stringified = getItem("_allsearch");
    var parsedArray = JSON.parse(stringified);

    var newoptions = new Array(parsedArray.length + 1);

    for (var i = 0; i < parsedArray.length; i++) {
        newoptions[i] = new Array(4);
        newoptions[i] = parsedArray[i].slice(0);
    }

    newoptions[i] = new Array(4);
    newoptions[i][0] = "-1";
    newoptions[i][1] = nname;
    newoptions[i][2] = nlink;
    newoptions[i][3] = true;

    var newstring = JSON.stringify(newoptions);
    setItem("_allsearch", newstring);

    restore_options();
    save_options();

    document.getElementById("newname").value = "";
    document.getElementById("newlink").value = "";
    var status = document.getElementById("status_addmanually");
    status.innerHTML = "Options Saved.";
    setTimeout(function () {
        status.innerHTML = "";
        //       showpage(2);
    }, 1250);
}

function resetdefault() {
    clearStrg();
    requestMenuRefresh();
    //alert(parsedArray);
    restore_options();
}

function AddFromList() {
    var numoptions = document.getElementById("numoptions").value;
    //alert("numoptions = "+numoptions);
    for (var j = 1; j <= numoptions; j++) {
        if (document.getElementById("s" + j).checked) {
            var nname = document.getElementById("names" + j).value;
            var nlink = document.getElementById("links" + j).value;

            var stringified = getItem("_allsearch");
            var parsedArray = JSON.parse(stringified);

            var newoptions = new Array(parsedArray.length + 1);

            for (var i = 0; i < parsedArray.length; i++) {
                newoptions[i] = new Array(4);
                newoptions[i] = parsedArray[i].slice(0);
            }

            newoptions[i] = new Array(4);
            newoptions[i][0] = "-1";
            newoptions[i][1] = nname;
            newoptions[i][2] = nlink;
            newoptions[i][3] = true;

            //alert(newoptions[i]);

            var newstring = JSON.stringify(newoptions);
            setItem("_allsearch", newstring);
            document.getElementById("s" + j).checked = false;

            restore_options();
            save_options();
        }
    }
    var status = document.getElementById("status_addfromlist");
    status.innerHTML = "Options Saved.";
    setTimeout(function () {
        status.innerHTML = "";
        showpage(1);
    }, 1250);
}


function showpage(page) {
    for (var i = 1; i <= PAGES_NBR; i++) {
        if (i === page) document.getElementById("page" + i).style.display = "block";
        else document.getElementById("page" + i).style.display = "none";
    }
}

$(document).ready(function () {
    initialise();
    $(function () {
        $("#options_list_ul").sortable({
            opacity: 0.3,
            cursor: 'move',
            update: function () {
                save_options();
            }
        });

        $("#showpage_1").click(function () {
            showpage(1);
        });

        $("#showpage_2").click(function () {
            showpage(2);
        });

        $("#add_option").click(function () {
            add_option();
        });

        $("#AddFromList").click(function () {
            AddFromList();
        });

        $("#save_options").click(function () {
            save_options(OPTIONS_KEY);
            save_options();
        });

        $("#resetdefault").click(function () {
            restore_options(OPTIONS_KEY);
            save_options();
        });

        $("#save_otheroptions").click(function () {
            save_otheroptions();
        });

        $("#save_import").click(function () {
            save_import();
        });

        //$("#ask_bg").unbind("click");
        $("#ask_bg").on("click", function (e) {
            setItem("_askbg", e.target.checked);
            e.stopImmediatePropagation();
        });


        $(".dropdown-menu li:first-child a").click(function (e) {
            return false;
        });

    });

});



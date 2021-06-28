function addHyphenInIndex(str,index) {
    return `${str.slice(0,index)}-${str.slice(index)}`;
}

function removeHourGlass() {
    var hourGlass = document.getElementById("HourGlass");
    hourGlass.parentElement.removeChild(hourGlass);
}

function isUserLoggedIn() {
    const mainDocument = window.parent.document;
    return mainDocument.getElementsByClassName("msgnorm")[0]?.getElementsByTagName("span").length > 0;
}

var vctb = null;
var vctl = null;
var vctln = null;
function startSession() {
    const msg = { action: "start_session" };
    chrome.runtime.sendMessage(
        chrome.runtime.id,
        msg,
        function(response) {
            if (response === null) {
                return;
            }

            vctb = response.vctb;
            vctl = response.vctl;
            vctln = response.vctln;

            removeHourGlass();
            addButtons();

            var buttons = document.getElementsByClassName("tau-factor-btns");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].disabled = false;
                buttons[i].style.cursor = "";
            }
        }
    );
}

function redirectForm(redirct, ID) {
    var forms = document.forms;
    for (var i = 0; i < forms.length; i++) {
        if (redirct) {
            forms[i].target = "frame_" + ID;
        } else {
            forms[i].target = "_self";
        }
    }
}


function addIframe(ID, name, btn) {
    const newFrame = document.createElement('iframe');
    newFrame.name = "frame_" + ID;
    newFrame.style.width = "0px";
    newFrame.style.height = "0px";
    newFrame.style.position = "absolute";
    newFrame.style.top = "0";
    newFrame.style.left = "0";
    newFrame.style.visibility = "hidden";
    newFrame.onload = (
        function(ID, name, btn) {
            var moeds = null;
            var groups = null;
            var groupIdx = 0;
            var moedIdx = 0;
            return function() {
                const iframeWindow = this.contentWindow;
                const iframeURL = iframeWindow.location.href;
                const iframe = iframeWindow.document;

                const should_get_exam_instances = (moeds === null) && (groups === null);
                const res = extractData(iframe, should_get_exam_instances);
                if (res === undefined) {
                    return;
                }

                if (should_get_exam_instances) {
                    if (res === false) {
                        alert("שגיאה בהוצאת נתונים מקורס זה");
                        btn.style.display = "none";
                        return;
                    }

                    moeds = res.moeds;
                    groups = res.groups;
                    moedIdx = -1;
                    groupIdx = 1; // no need for all groups together
                } else if (res !== false) {
                    res["course_name"] = name;
                    submitGrades(res);
                }

                if (moedIdx == moeds.length-1 && groupIdx == groups.length-1) {
                    btn.src = "/IncNet/Images/vi.gif";
                    this.parentNode.removeChild(this);
                    return;
                }

                if (moedIdx == moeds.length - 1) {
                    groupIdx++;
                    moedIdx = -1;
                }

                var selects = iframe.getElementsByTagName("select");

                var groupSelect = getGroupSelect(selects);
                var groupOption = groupSelect.options[groupIdx];
                groupOption.selected = true;
                groupSelect.dispatchEvent(new Event('change'));

                var moedSelect = getMoedSelect(selects);
                var moedOption = moedSelect.options[++moedIdx];
                moedOption.selected = true;
                moedSelect.dispatchEvent(new Event('change'));

                iframe.getElementById("btnshow").click();
            };
        }
    )(ID, name, btn);
    document.body.appendChild(newFrame);
    return newFrame;
}

function getGroupSelect(selects) {
    for (var i = 0; i < selects.length; i++) {
        if (selects[i].offsetParent === null) {
            continue;
        }
        for (var j = 0; j < selects[i].options.length; j++) {
            if (selects[i].options[j].innerText.indexOf("הכל") != -1) {
                return selects[i];
            }
        }
    }
    return selects[0];
}

function getMoedSelect(selects) {
    var groupSelect = selects[1];
    for (var i = 0; i < selects.length; i++) {
        if (selects[i].offsetParent === null) {
            continue;
        }
        for (var j = 0; j < selects[i].options.length; j++) {
            if (selects[i].options[j].innerText.indexOf("קובע") != -1) {
                return selects[i];
            }
        }
    }
    return selects[1];
}

function extractData(iframe, should_get_exam_instances) {
    if(iframe.getElementsByClassName("msgerrs rounddiv").length > 0 || 
       iframe.body.innerText.indexOf("אין ציונים בקורס") != -1) {
        return false;
    }

    var selects = iframe.getElementsByTagName("select");
    if (selects.length === 0) {
        return undefined;
    }

    var groupSelect = getGroupSelect(selects);
    var moedSelect = getMoedSelect(selects);

    if (should_get_exam_instances) {
        var groups = [];
        var groupOptions = groupSelect.options;
        for (var i = 0; i < groupOptions.length; i++) {
            groups.push(groupOptions[i].value);
        }

        var moeds = [];
        var moedOptions = moedSelect.options;
        for (var i = 0; i < moedOptions.length; i++) {
            moeds.push(moedOptions[i].value);
        }

        return {groups: groups, moeds: moeds};
    }

    var tables = iframe.getElementsByTagName("table");
    var teachersTable = tables[0];
    var statsTable = tables[1];
    var gradesTable = tables[3];
    for (var i = 0; i < tables.length; i++) {
        if (tables[i].offsetParent === null) {
            continue;
        }
        if (tables[i].innerText.indexOf("מרצה") != -1) {
            teachersTable = tables[i];
        }
        if (tables[i].innerText.indexOf("ממוצע") != -1 && tables[i].innerText.indexOf("סטיית תקן") != -1) {
            statsTable = tables[i];
        }
        if (tables[i].innerText.indexOf("תחום") != -1 && tables[i].innerText.indexOf("ציונים") != -1) {
            gradesTable = tables[i];
        }
    }

    var teacher_names = teachersTable.innerText.split("מרצה:")[1].trim();
    for (var i = 0; i < teachersTable.rows.length; i++) {
        if (teachersTable.rows[i].offsetParent === null) {
            continue;
        }
        for (var j = 0; j < teachersTable.rows[i].cells.length-1; j++) {
            if (teachersTable.rows[i].cells[j].innerText.indexOf("מרצה") != -1) {
                teacher_names = teachersTable.rows[i].cells[j+1].innerText.trim();
                break;
            }
        }
    }

    var students_count, failures_count, mean, median, standard_deviation = {};
    var grades = [];
    for (var i = 0; i < statsTable.rows.length; i++) {
        if (statsTable.rows[i].offsetParent === null) {
            continue;
        }
        for (var j = 0; j < statsTable.rows[i].cells.length-1; j++) {
            var key = statsTable.rows[i].cells[j].innerText;
            var val = statsTable.rows[i].cells[j+1].innerText;
            if (key.indexOf("נבחנים") != -1) {
                students_count = val;
            } else if (key.indexOf("מס' נכשלים") != -1) {
                failures_count = val;
            } else if (key.indexOf("ממוצע") != -1) {
                mean = val;
            } else if (key.indexOf("חציון") != -1) {
                median = val;
            } else if (key.indexOf("סטיית תקן") != -1) {
                standard_deviation = val;
            }
        }
    }

    var rangePos = 2;
    var testeesPos = 1;
    var first = true;
    for (var i = 0; i < gradesTable.rows.length; i++) {
        if (gradesTable.rows[i].offsetParent === null) {
            continue;
        }
        var row = gradesTable.rows[i].cells;
        if (first) {
            for (var j = 0; j < row.length; j++) {
                if (row[j].innerText.indexOf("תחום") != -1) {
                    rangePos = j;
                }
                if (row[j].innerText.indexOf("נבחנים") != -1) {
                    testeesPos = j;
                }
            }
            first = false;
        } else {
            var range = row[rangePos].innerText.trim().split("-");
            var amount = row[testeesPos].innerText.trim();
            grades.push({
                lowest_grade: range[0],
                highest_grade: range[1],
                students_in_range: amount
            });
        }
    }

    var course_data = iframe.getElementsByClassName("listtd rounddiv2")[0].getElementsByTagName("b");
    var year_sem = course_data[1].innerHTML.split("/");

    const course_code = addHyphenInIndex(course_data[0].innerHTML.split("-")[0], 4);

    var year = year_sem[0];
    var semester_num = year_sem[1];
    const semester_num_to_val = {
        "1": "A",
        "2": "B",
        "3": "SUMMER",
        "4": "ALL_YEAR"
    };

    var group = groupSelect.value;
    var moed = (moedSelect.value < 9) ? moedSelect.value : 0; // 9 is final grade, which is marked in backend as 0

    return {
        course_code: course_code,
        teacher_names: teacher_names.split("\n"),
        year: year,
        semester: semester_num_to_val[semester_num],
        course_group_name: group,
        moed: moed,
        students_count: students_count,
        failures_count: failures_count,
        grades: grades,
        mean: mean,
        median: median,
        standard_deviation: standard_deviation
    };
}

function submitGrades(data) {
    const msg = { action: "submit_grades", data: data };
    chrome.runtime.sendMessage(chrome.runtime.id, msg);
}

function styleButton(btn) {
    btn.className = "tau-factor-btns";
    btn.disabled = true;
    btn.style.cursor = "default";
    btn.type  = "image";
    btn.src   = "/IncNet/Images/Buttons/ishur.gif";
    btn.align = "absmiddle";
    btn.alt   = "שלח";
    btn.onmouseover =  function() { this.src="/IncNet/Images/Buttons/ishur_over.gif"; };
    btn.onmouseout =  function() { this.src="/IncNet/Images/Buttons/ishur.gif"; };
    return btn;
}

function addButtons() {
    var tables = document.getElementsByTagName("table");

    var rmTables = [];
    for (var i = tables.length-1; i >= 0; i--) {
        if (tables[i].offsetParent === null || tables[i].style.display.toLowerCase() == "none") {
            tables[i].parentElement.removeChild(tables[i]);
        }
    }

    var tables = document.getElementsByTagName("table");
    var table = tables[1];
    for (var i = 0 ; i < tables.length; i++) {
        var f = true;
        for (var j = 0; j < vctb.length; j++) {
            if (tables[i].innerText.indexOf(vctb[j]) == -1) {
                f = false;
                break;
            }
        }
        if (f) {
            table = tables[i];
            break;
        }
    }
    vctb = null;

    var rows = table.rows;
    var courseIDPos = 1;
    var courseNamePos = 2;
    var addedTitle = false;
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].offsetParent === null) {
            continue;
        }
        if (rows[i].cells.length == 1) {
            rows[i].cells[0].colSpan++;
        } else if (!addedTitle) {
            if (rows[i].cells[0].tagName.toLowerCase() == "th" || rows[i].className == "listths" || rows[i].innerText.indexOf(vctl) != -1) {
                for (var j = 0 ; j < rows[i].cells.length; j++) {
                    if (rows[i].cells[j].innerText.indexOf(vctl) != -1) {
                        if (rows[i].cells[j].innerText.indexOf(vctln) != -1) {
                            courseNamePos = j;
                        } else {
                            courseIDPos = j;
                        }
                    }
                }
                var newCell = rows[i].insertCell(-1);
                newCell.innerHTML = "הוסף ל-" + "<br />" + "tau-factor";
                addedTitle = true;
                vctl = null;
                vctln = null;
            }
        } else {
            var originalButton = rows[i].cells[rows[i].cells.length-1].children[0];
            var newCell = rows[i].insertCell(-1);
            if (originalButton === undefined) {
                continue;
            }

            var courseID = rows[i].cells[courseIDPos].innerText.replace("-", "");
            var courseName = rows[i].cells[courseNamePos].innerText;

            var success = document.createElement('img');
            success.src = "/IncNet/Images/vi.gif";
            success.style.display = "none";
            newCell.appendChild(success);

            var btn = document.createElement('input');
            btn = styleButton(btn);
            btn.onclick = (function(ID, name, originalButton) {
                return function() {
                    this.src = "/IncNet/Images/ajax_orange.gif";
                    this.style.cursor = "default";
                    this.disabled = true;

                    addIframe(ID, name, this);

                    redirectForm(true, ID);
                    originalButton.click();
                    originalButton.checked = false;
                    redirectForm(false, ID);
                };
            })(courseID, courseName, originalButton);

            var frm = document.createElement("form");
            frm.style = "text-align: center";
            frm.onsubmit = function() { return false; };
            frm.appendChild(btn);
            newCell.appendChild(frm);
        }
    }
}

function startExtension() {
    if (isUserLoggedIn()) {
        startSession();
    }
}

startExtension();

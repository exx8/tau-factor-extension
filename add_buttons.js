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

                const should_get_available_exams = (moeds === null) && (groups === null);
                const res = should_get_available_exams ? getAvailableExams(iframe) : extractData(iframe);
                if (res === undefined) {
                    return;
                }

                if (should_get_available_exams) {
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

function getExamStatistics(stats_table) {
    var students_count, failures_count, mean, median, standard_deviation = {};
    for (var i = 0; i < stats_table.rows.length; i++) {
        const row = stats_table.rows[i];
        if (row.offsetParent === null) {
            continue;
        }
        for (var j = 0; j < row.cells.length-1; j++) {
            var key = row.cells[j].innerText;
            var val = row.cells[j+1].innerText;
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

    return {
        students_count: students_count,
        failures_count: failures_count,
        mean: mean,
        median: median,
        standard_deviation: standard_deviation
    };
}

function getExamGrades(grades_table) {
    var grades = [];
    var grade_range_pos = 2;
    var num_testees_pos = 1;

    const headers_cells = grades_table.rows[0].cells;
    for (var cell_idx = 0; cell_idx < headers_cells.length; cell_idx++) {
        const cell = headers_cells[cell_idx];
        if (cell.innerText.indexOf("תחום") != -1) {
            grade_range_pos = cell_idx;
        }
        if (cell.innerText.indexOf("נבחנים") != -1) {
            num_testees_pos = cell_idx;
        }
    }

    for (var row_idx = 1; row_idx < grades_table.rows.length; row_idx++) {
        const row = grades_table.rows[row_idx];
        if (row.offsetParent !== null) {
            var cells = row.cells;
            var grade_range = cells[grade_range_pos].innerText.trim().split("-");
            var num_testees = cells[num_testees_pos].innerText.trim();
            grades.push({
                lowest_grade: grade_range[0],
                highest_grade: grade_range[1],
                students_in_range: num_testees
            });
        }
    }

    return {
        grades: grades,
    };
}

function getExamTeachers(teachers_table) {
    const teacher_table_bolds = teachers_table.getElementsByTagName("b");
    const teacher_names = teacher_table_bolds[teacher_table_bolds.length-1].innerText.trim().split("\n");
    if (teacher_names.length == 0 || (teacher_names.length == 1 && teacher_names[0] === "")) {
        return {};
    }
    else {
        return {
            teacher_names: teacher_names
        };
    }
}

function getGeneralExamData(iframe) {
    const course_data = iframe.getElementsByClassName("listtd rounddiv2")[0].getElementsByTagName("b");
    const year_sem = course_data[1].innerHTML.split("/");

    const course_code = addHyphenInIndex(course_data[0].innerHTML.split("-")[0], 4);

    const year = year_sem[0];
    const semester_num = year_sem[1];
    const semester_num_to_val = {
        "1": "A",
        "2": "B",
        "3": "SUMMER",
        "4": "ALL_YEAR"
    };
    const semester = semester_num_to_val[semester_num];

    return {
        course_code: course_code,
        year: year,
        semester: semester
    };
}


function getAvailableExams(iframe) {
    if(iframe.getElementsByClassName("msgerrs rounddiv").length > 0 || 
       iframe.body.innerText.indexOf("אין ציונים בקורס") != -1) {
        return false;
    }

    var selects = iframe.getElementsByTagName("select");
    if (selects.length === 0) {
        return undefined;
    }

    var groups = [];
    const groupSelect = getGroupSelect(selects);
    const groupOptions = groupSelect.options;
    for (var group_idx = 0; group_idx < groupOptions.length; group_idx++) {
        groups.push(groupOptions[group_idx].value);
    }

    var moeds = [];
    const moedSelect = getMoedSelect(selects);
    const moedOptions = moedSelect.options;
    for (var moed_idx = 0; moed_idx < moedOptions.length; moed_idx++) {
        moeds.push(moedOptions[moed_idx].value);
    }

    return {groups: groups, moeds: moeds};
}

function extractData(iframe) {
    if(iframe.getElementsByClassName("msgerrs rounddiv").length > 0 || 
       iframe.body.innerText.indexOf("אין ציונים בקורס") != -1) {
        return false;
    }

    var selects = iframe.getElementsByTagName("select");
    if (selects.length === 0) {
        return undefined;
    }

    const tables = iframe.getElementsByTagName("table");
    var teachersTable = tables[0];
    var statsTable = tables[1];
    var gradesTable = tables[3];
    for (var table_idx = 0; table_idx < tables.length; table_idx++) {
        const table = tables[table_idx];
        if (table.offsetParent !== null) {
            const table_content = table.innerText;
            if (table_content.indexOf("מרצה") != -1) {
                teachersTable = table;
            }
            if (table_content.indexOf("ממוצע") != -1 && table_content.indexOf("סטיית תקן") != -1) {
                statsTable = table;
            }
            if (table_content.indexOf("תחום") != -1 && table_content.indexOf("ציונים") != -1) {
                gradesTable = table;
            }
        }
    }

    const groupSelect = getGroupSelect(selects);
    const course_group_name = (groupSelect.value !== "") ? groupSelect.value : "00";

    const moedSelect = getMoedSelect(selects);
    const moed = (moedSelect.value < 9) ? moedSelect.value : 0; // 9 is final grade, which is marked in backend as 0

    return {
        course_group_name: course_group_name,
        moed: moed,
        ...getExamTeachers(teachersTable),
        ...getGeneralExamData(iframe),
        ...getExamGrades(gradesTable),
        ...getExamStatistics(statsTable)
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

var EXT_VERSION = "3.0.0";

function ajaxSend(method, api, params, callback) {
    var ajax = new XMLHttpRequest();

    ajax.onreadystatechange = (function (cb) {
        return function() {
            if (ajax.readyState == 4) {
                callback(ajax.status, ajax.responseText);
            }
        };
    }) (callback);

    // var url = `https://www.tau-factor.com/api/v1${api}`;
    var url = `https://tau-factor.herokuapp.com/api/v1${api}`;
    if (method == "GET") {
        const prms = new URLSearchParams(params);
        url = `${url}?${prms.toString()}`;
    }


    ajax.open(method, url, true);
    ajax.setRequestHeader("Content-Type", "application/json");
    ajax.setRequestHeader("Extension-Version", EXT_VERSION);


    const request = (method == "POST") ? JSON.stringify(params) : null;
    ajax.send(request);
}

function startSession(sendResponse) {
    const callback = (function(sendResponse) {
        return function (response_status, response_text) {
            try {
                if (response_status == 200) {
                    const response_json = JSON.parse(response_text);
                    sendResponse(response_json);
                }
                if (response_status == 400) {
                    const response_json = JSON.parse(response_text);
                    console.log(response_json?.detail);
                    sendResponse(null);
                }
            } catch (e) {
                console.log("Session Couldn't load");
                sendResponse(null);
            }
        };
    }) (sendResponse);

    const params = {};
    ajaxSend("GET", "/extension/get_collectable_fields", params, callback);
    return true;
}

function createCourse(data, callback) {
    const params = {
        course_code: data.course_code,
        year: data.year,
        semester: data.semester,
        names: [
            {
                language: "HE",
                course_name: data.course_name,
            }
        ]
    };

    const wrapped_callback = (function(callback) {
        return function (response_status, response_text) {
            try {
                if (response_status == 201) {
                    const response_json = JSON.parse(response_text);
                    callback(response_json.course_instance_id);
                }
                if (response_status == 400) {
                    const response_json = JSON.parse(response_text);
                    console.log(response_json?.detail);
                    callback(null);
                }
            } catch (e) {
                console.log("Could not create course");
                callback(null);
            }
        };
    })(callback);

    ajaxSend("POST", "/courses/create_course/", params, wrapped_callback);
}

function createCourseGroup(data, callback) {
    const params = {
        course_instance_id: data.course_instance_id,
        course_group_name: data.course_group_name,
        teachers: data.teacher_names,
    };

    const wrapped_callback = (function(callback) {
        return function (response_status, response_text) {
            try {
                if (response_status == 201) {
                    const response_json = JSON.parse(response_text);
                    callback(response_json.course_group_id);
                }
                if (response_status == 400) {
                    const response_json = JSON.parse(response_text);
                    console.log(response_json?.detail);
                    callback(null);
                }
            } catch (e) {
                console.log("Could not create course group");
                callback(null);
            }
        };
    })(callback);

    ajaxSend("POST", "/courses/create_course_group/", params, wrapped_callback);
}


function addExam(data, callback) {
    const params = {
        course_group_id: data.course_group_id,
        moed: data.moed,
        students_count: data.students_count,
        failures_count: data.failures_count,
        statistics: {
            mean: data.mean,
            median: data.median,
            standard_deviation: data.standard_deviation
        },
        grades: data.grades
    };

    const wrapped_callback = (function(callback) {
        return function (response_status, response_text) {
            try {
                if (response_status == 201) {
                    const response_json = JSON.parse(response_text);
                    callback(true);
                }
                if (response_status == 400) {
                    const response_json = JSON.parse(response_text);
                    console.log(response_json?.detail);
                    callback(false);
                }
            } catch (e) {
                console.log("Could not add exam data");
                callback(false);
            }
        };
    })(callback);

    ajaxSend("POST", "/grades/add_exam/", params, wrapped_callback);
}


function submitGrades(data, sendResponse) {
    const addExamCallback = (function(data, sendResponse) {
        return function (success) {
            sendResponse(success);
        };
    })(data, sendResponse);

    const createCourseGroupCallback = (function(data, addExamCallback) {
        return function (course_group_id) {
            if (course_group_id === null) {
                addExamCallback(null);
            }
            data["course_group_id"] = course_group_id;
            addExam(data, addExamCallback);
        };
    })(data, addExamCallback);

    const createCourseCallback = (function(data, createCourseGroupCallback) {
        return function (course_instance_id) {
            if (course_instance_id === null) {
                createCourseGroupCallback(null);
            }
            data["course_instance_id"] = course_instance_id;
            createCourseGroup(data, createCourseGroupCallback);
        };
    })(data, createCourseGroupCallback);

    createCourse(data, createCourseCallback);
    return true;
}


chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg?.action === "start_session") {
        return startSession(sendResponse);
    }
    if (msg?.action === "submit_grades") {
        return submitGrades(msg.data, sendResponse);
    }
});
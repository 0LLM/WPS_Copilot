var EnumOAFlag = {
    DocFromOA: 1,
    DocFromNoOA: 0
}

//记录是否用户点击OA文件的保存按钮
var EnumDocSaveFlag = {
    OADocSave: 1,
    NoneOADocSave: 0
}

//标识文档的落地模式 本地文档落地 0 ，不落地 1
var EnumDocLandMode = {
    DLM_LocalDoc: 0,
    DLM_OnlineDoc: 1
}

//加载时会执行的方法
function OnWPSWorkTabLoad(ribbonUI) {
    wps.ribbonUI = ribbonUI;

    OnJSWorkInit(); //初始化文档事件(全局参数,挂载监听事件)
    activeTab(); // 激活OA助手菜单
    OpenTimerRun(OnDocSaveByAutoTimer); //启动定时备份过程
    return true;
}

//文档各类初始化工作（WPS Js环境）
function OnJSWorkInit() {
    pInitParameters(); //OA助手环境的所有配置控制的初始化过程
    AddWorkbookEvent(); //挂接文档事件处理函数
}


//初始化全局参数
function pInitParameters() {
    wps.PluginStorage.setItem("OADocUserSave", EnumDocSaveFlag.NoneOADocSave); //初始化，没有用户点击保存按钮

    var l_wpsUserName = wps.EtApplication().UserName;
    wps.PluginStorage.setItem("WPSInitUserName", l_wpsUserName); //在OA助手加载前，先保存用户原有的WPS应用用户名称

    wps.PluginStorage.setItem("OADocCanSaveAs", false); //默认OA文档不能另存为本地
    wps.PluginStorage.setItem("AllowOADocReOpen", false); //设置是否允许来自OA的文件再次被打开
    wps.PluginStorage.setItem("ShowOATabDocActive", false); //设置新打开文档是否默认显示OA助手菜单Tab  //默认为false

    wps.PluginStorage.setItem("DefaultUploadFieldName", "file"); //针对UploadFile方法设置上载字段名称

    wps.PluginStorage.setItem("AutoSaveToServerTime", "10"); //自动保存回OA服务端的时间间隔。如果设置0，则关闭，最小设置3分钟
    wps.PluginStorage.setItem("TempTimerID", "0"); //临时值，用于保存计时器ID的临时值

    // 以下是一些临时状态参数，用于打开文档等的状态判断
    wps.PluginStorage.setItem("IsInCurrOADocOpen", false); //用于执行来自OA端的新建或打开文档时的状态
    wps.PluginStorage.setItem("IsInCurrOADocSaveAs", false); //用于执行来自OA端的文档另存为本地的状态
}

//挂载WPS的表格事件
function AddWorkbookEvent() {
    wps.ApiEvent.AddApiEventListener("WindowActivate", OnWindowActivate);
    wps.ApiEvent.AddApiEventListener("WorkbookBeforeClose", OnWorkbookBeforeClose);
    wps.ApiEvent.AddApiEventListener("WorkbookBeforeSave", OnWorkbookBeforeSave);
    wps.ApiEvent.AddApiEventListener("WorkbookOpen", OnWorkbookOpen);
    wps.ApiEvent.AddApiEventListener("NewWorkbook", OnWorkbookNew);
    console.log("AddWorkbookEvent");
}

/**
 * 根据传入Document对象，获取OA传入的参数的某个Key值的Value
 * @param {*} Doc 
 * @param {*} Key 
 * 返回值：返回指定 Key的 Value
 */
function GetDocParamsValue(Doc, Key) {
    if (!Doc) {
        return "";
    }

    var l_Params = wps.PluginStorage.getItem(Doc.FullName);
    if (!l_Params) {
        return "";
    }

    var l_objParams = JSON.parse(l_Params);
    if (typeof (l_objParams) == "undefined") {
        return "";
    }

    var l_rtnValue = l_objParams[Key];
    if (typeof (l_rtnValue) == "undefined" || l_rtnValue == null) {
        return "";
    }
    return l_rtnValue;
}

/**
 *  作用：根据OA传入参数，设置是否显示Ribbob按钮组
 *  参数：CtrlID 是OnGetVisible 传入的Ribbob控件的ID值
 */
function pShowRibbonGroupByOADocParam(CtrlID) {
    var l_Doc = wps.EtApplication().ActiveWorkbook;
    if (!l_Doc) {
        return false; //如果未装入文档，则设置OA助手按钮组不可见
    }

    //获取OA传入的按钮组参数组
    var l_grpButtonParams = GetDocParamsValue(l_Doc, "buttonGroups"); //disableBtns
    l_grpButtonParams = l_grpButtonParams + "," + GetDocParamsValue(l_Doc, "disableBtns");
    // 要求OA传入控制自定义按钮显示的参数为字符串 中间用 , 分隔开
    if (typeof (l_grpButtonParams) == "string") {
        var l_arrayGroup = new Array();
        l_arrayGroup = l_grpButtonParams.split(",");
        //console.log(l_grpButtonParams);

        // 判断当前按钮是否存在于数组
        if (l_arrayGroup.indexOf(CtrlID) >= 0) {
            return false;
        }
    }
    // 添加OA菜单判断
    if (CtrlID == "WPSWorkExtTab") {
        return true; //业务系统根据实际情况自己来判断
        /*
        var l_value = wps.PluginStorage.getItem("ShowOATabDocActive");
        wps.PluginStorage.setItem("ShowOATabDocActive", false); //初始化临时状态变量
        console.log("菜单：" + l_value);
        return l_value;
        */
    }

    //disableBtns

    return true;
}

/**
 * 调用文件上传到OA服务端时，
 * @param {*} resp 
 * wdDoNotSaveChanges	0	 *不保存待定的更改。
 * wdPromptToSaveChanges	-2	 *提示用户保存待定更改。
 * wdSaveChanges	-1	 *自动保存待定更改，而不提示用户。
 */
function OnUploadToServerSuccess(resp) {
    var l_doc = wps.EtApplication().ActiveWorkbook;
    if (wps.confirm("文件上传成功！继续编辑请确认，取消关闭文档。") == false) {
        if (l_doc) {
            console.log("OnUploadToServerSuccess: before Close");
            l_doc.Close(-1); //保存文档后关闭
            console.log("OnUploadToServerSuccess: after Close");
        }
    }

    var l_NofityURL = GetDocParamsValue(l_doc, "notifyUrl");
    if (l_NofityURL != "") {
        l_NofityURL = l_NofityURL.replace("{?}", "2"); //约定：参数为2则文档被成功上传
        NotifyToServer(l_NofityURL);
    }
}

function OnUploadToServerFail(resp) {
    alert("文件上传失败！");
}

//判断当前文档是否是OA文档
function pCheckIfOADoc() {
    var doc = wps.EtApplication().ActiveWorkbook;
    if (!doc)
        return false;
    return CheckIfDocIsOADoc(doc);
}

//根据传入的doc对象，判断当前文档是否是OA文档
function CheckIfDocIsOADoc(doc) {
    if (!doc) {
        return false;
    }
    var l_isOA = GetDocParamsValue(doc, "isOA");
    if (l_isOA == "") {
        return false
    };
    return l_isOA == EnumOAFlag.DocFromOA ? true : false;
}

//返回是否可以点击OA保存按钮的状态
function OnSetSaveToOAEnable() {
    return pCheckIfOADoc();
}

/**
 * 作用：判断是否是不落地文档
 * 参数：doc 文档对象
 * 返回值： 布尔值
 */
function pIsOnlineOADoc(doc) {
    var l_LandMode = GetDocParamsValue(doc, "OADocLandMode"); //获取文档落地模式
    if (l_LandMode == "") { //用户本地打开的文档
        return false;
    }
    return l_LandMode == EnumDocLandMode.DLM_OnlineDoc;
}

//保存到OA后台服务器
function OnBtnSaveToServer() {
    // console.log('SaveToServer');
    var l_doc = wps.EtApplication().ActiveWorkbook;
    if (!l_doc) {
        alert("空文档不能保存！");
        return;
    }

    //非OA文档，不能上传到OA
    if (pCheckIfOADoc() == false) {
        alert("非系统打开的文档，不能直接上传到系统！");
        return;
    }

    //如果是OA打开的文档，并且设置了保护的文档，则不能再上传到OA服务器
    if (pISOADocReadOnly(l_doc)) {
        wps.alert("系统设置了保护的文档，不能再提交到系统后台。");
        return;
    }

    /**
     * 参数定义：OAAsist.UploadFile(name, path, url, field,  "OnSuccess", "OnFail")
     * 上传一个文件到远程服务器。
     * name：为上传后的文件名称；
     * path：是文件绝对路径；
     * url：为上传地址；
     * field：为请求中name的值；
     * 最后两个参数为回调函数名称；
     */
    var l_uploadPath = GetDocParamsValue(l_doc, "uploadPath"); // 文件上载路径
    if (l_uploadPath == "") {
        wps.alert("系统未传入文件上载路径，不能执行上传操作！");
        return;
    }

    if (!wps.confirm("先保存文档，并开始上传到系统后台，请确认？")) {
        return;
    }

    var l_FieldName = GetDocParamsValue(l_doc, "uploadFieldName"); //上载到后台的字段名称
    if (l_FieldName == "") {
        l_FieldName = wps.PluginStorage.getItem("DefaultUploadFieldName"); // 默认为‘file’
    }

    var l_UploadName = GetDocParamsValue(l_doc, "uploadFileName"); //设置OA传入的文件名称参数
    if (l_UploadName == "") {
        l_UploadName = l_doc.Name; //默认文件名称就是当前文件编辑名称
    }

    var l_DocPath = l_doc.FullName; // 文件所在路径

    if (pIsOnlineOADoc(l_doc) == false) {
        //对于本地磁盘文件上传OA，先用Save方法保存后，再上传
        //设置用户保存按钮标志，避免出现禁止OA文件保存的干扰信息
        wps.PluginStorage.setItem("OADocUserSave", EnumDocSaveFlag.OADocSave);
        l_doc.Save(); //执行一次保存方法
        //设置用户保存按钮标志
        wps.PluginStorage.setItem("OADocUserSave", EnumDocSaveFlag.NoneOADocSave);
        //落地文档，调用UploadFile方法上传到OA后台
        try {
            //调用OA助手的上传方法
            UploadFile(l_UploadName, l_DocPath, l_uploadPath, l_FieldName, OnUploadToServerSuccess, OnUploadToServerFail);
        } catch (err) {
            alert("上传文件失败！请检查系统上传参数及网络环境！");
        }
    } else {
        // 不落地的文档，调用 Document 对象的不落地上传方法
        wps.PluginStorage.setItem("OADocUserSave", EnumDocSaveFlag.OADocSave);
        try {
            //调用不落地上传方法
            l_doc.SaveAsUrl(l_UploadName, l_uploadPath, l_FieldName, "OnUploadToServerSuccess", "OnUploadToServerFail");
        } catch (err) {
            alert("上传文件失败！请检查系统上传参数及网络环境，重新上传。");
        }
        wps.PluginStorage.setItem("OADocUserSave", EnumDocSaveFlag.NoneOADocSave);
    }

    //获取OA传入的 转其他格式上传属性
    var l_suffix = GetDocParamsValue(l_doc, "suffix");
    if (l_suffix == "") {
        console.log("上传需转换的文件后缀名错误,无妨进行转换上传!");
        return;
    }

    //判断是否同时上传PDF等格式到OA后台
    var l_uploadWithAppendPath = GetDocParamsValue(l_doc, "uploadWithAppendPath"); //标识是否同时上传OFD、PDF等格式的文件
    if (l_uploadWithAppendPath == "1") {
        //调用转 pdf格式函数，强制关闭转换修订痕迹
        pDoChangeToOtherDocFormat(l_doc, l_suffix, false, false); //
    }
    return;
}

/**
 *  执行另存为本地文件操作
 */
function OnBtnSaveAsLocalFile() {

    //初始化临时状态值
    wps.PluginStorage.setItem("OADocUserSave", false);
    wps.PluginStorage.setItem("IsInCurrOADocSaveAs", false);

    //检测是否有文档正在处理
    var l_doc = wps.EtApplication().ActiveWorkbook;
    if (!l_doc) {
        alert("WPS当前没有可操作文档！");
        return;
    }

    // 设置WPS文档对话框 2 FileDialogType:=msoFileDialogSaveAs
    var l_ksoFileDialog = wps.EtApplication().FileDialog(2);
    l_ksoFileDialog.InitialFileName = l_doc.Name; //文档名称

    if (l_ksoFileDialog.Show() == -1) { // -1 代表确认按钮
        wps.PluginStorage.setItem("OADocUserSave", true); //设置保存为临时状态，在Save事件中避免OA禁止另存为对话框
        l_ksoFileDialog.Execute(); //会触发保存文档的监听函数

        pSetNoneOADocFlag(l_doc);
        wps.ribbonUI.Invalidate(); //刷新Ribbon的状态
    };
}

/**
 * 获取对象中属性的值
 * @param {*} params 
 * @param {*} Key 
 */
function GetParamsValue(Params, Key) {
    if (typeof (Params) == "undefined") {
        return "";
    }

    var l_rtnValue = Params[Key];
    return l_rtnValue;
}


function OnAction(control) {
    var eleId;
    if (typeof control == "object" && arguments.length == 1) { //针对Ribbon的按钮的
        eleId = control.Id;
    } else if (typeof control == "undefined" && arguments.length > 1) { //针对idMso的
        eleId = arguments[1].Id;
    } else if (typeof control == "boolean" && arguments.length > 1) { //针对checkbox的
        eleId = arguments[1].Id;
    } else if (typeof control == "number" && arguments.length > 1) { //针对combox的
        eleId = arguments[2].Id;
    }
    switch (eleId) {
        case "btnSaveToServer":
            OnBtnSaveToServer();
            break;
        case "btnSaveAsFile":
            OnBtnSaveAsLocalFile();
            break;
        default:
            ;
    }
    return true;
}

function OnGetEnabled(control) {
    var eleId;
    if (typeof control == "object" && arguments.length == 1) { //针对Ribbon的按钮的
        eleId = control.Id;
    } else if (typeof control == "undefined" && arguments.length > 1) { //针对idMso的
        eleId = arguments[1].Id;
    } else if (typeof control == "boolean" && arguments.length > 1) { //针对checkbox的
        eleId = arguments[1].Id;
    } else if (typeof control == "number" && arguments.length > 1) { //针对combox的
        eleId = arguments[2].Id;
    }
    switch (eleId) {
        case "btnSaveToServer": //保存到OA服务器的相关按钮。判断，如果非OA文件，禁止点击
            return OnSetSaveToOAEnable();
        case "btnSaveAsFile":
            let doc=wps.EtApplication().ActiveWorkbook;
            let l_Params=wps.PluginStorage.getItem(doc.FullName);
            let OADocLandMode=JSON.parse(l_Params).OADocLandMode
            return !OADocLandMode
        default:
            ;
    }
    return true;
}

function OnGetVisible(control) {
    var eleId;
    if (typeof control == "object" && arguments.length == 1) { //针对Ribbon的按钮的
        eleId = control.Id;
    } else if (typeof control == "undefined" && arguments.length > 1) { //针对idMso的
        eleId = arguments[1].Id;
    } else if (typeof control == "boolean" && arguments.length > 1) { //针对checkbox的
        eleId = arguments[1].Id;
    } else if (typeof control == "number" && arguments.length > 1) { //针对combox的
        eleId = arguments[2].Id;
    }
    var l_value = false;
    //按照 OA文档传递过来的属性进行判断
    l_value = pShowRibbonGroupByOADocParam(eleId);
    return l_value;
}

function GetImage(control) {
    var eleId;
    if (typeof control == "object" && arguments.length == 1) { //针对Ribbon的按钮的
        eleId = control.Id;
    } else if (typeof control == "undefined" && arguments.length > 1) { //针对idMso的
        eleId = arguments[1].Id;
    } else if (typeof control == "boolean" && arguments.length > 1) { //针对checkbox的
        eleId = arguments[1].Id;
    } else if (typeof control == "number" && arguments.length > 1) { //针对combox的
        eleId = arguments[2].Id;
    }
    switch (eleId) {
        case "btnSaveToServer": //保存到OA后台服务端
            return "./icon/w_Save.png";
        case "btnSaveAsFile": //另存为本地文件
            return "./icon/w_SaveAs.png";
        default:
            ;
    }
    return "./icon/c_default.png";
}

function OnGetLabel(control) {
    var eleId;
    if (typeof control == "object" && arguments.length == 1) { //针对Ribbon的按钮的
        eleId = control.Id;
    } else if (typeof control == "undefined" && arguments.length > 1) { //针对idMso的
        eleId = arguments[1].Id;
    } else if (typeof control == "boolean" && arguments.length > 1) { //针对checkbox的
        eleId = arguments[1].Id;
    } else if (typeof control == "number" && arguments.length > 1) { //针对combox的
        eleId = arguments[2].Id;
    }
    switch (eleId) {
        case "btnSaveAsFile":
            return "另存为本地";
        default:
            ;
    }
    return "";
}
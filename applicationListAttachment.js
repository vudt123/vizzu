var lgr = service.lgr;
var nvl = service.nvl;
var gRB = form.getResourceBundle;
var inputParams = template.data.inputParams;

template.nvl = nvl;
template.inputParams = template.data.parentForm.inputParams;
template.formParams = template.data.parentForm.formParams;
template.parentForm = template.data.parentForm;
template.editMode = (template.inputParams.EDITMODE === 'YES') || (template.inputParams.EDITMODE+'' == 'true');

template.attachObj = (function(gridId){
    var obj = {};
    var options = {};
    options.pageFlow = form.getCurrentProjectSysname() + '/COMMON/EXTLOOKUP/attachmentTypeExtLkp';
    options.calcSize = function (sz) {
        var sz = service.strToNum(sz);
        if (sz < 1024) {
            return sz + ' ' + gRB('bytes');
        } else {
            sz /= 1024;
            if (sz < 1024) {
                return Math.round(sz * 10, 2) / 10 + ' ' + gRB('KB');
            } else {
                sz /= 1024;
                return Math.round(sz * 10, 2) / 10 + ' ' + gRB('MB');
            }
        }
        return '-';
    };

    options.getSubjectName = function (id) {
        var subjectList = nvl(template.inputParams.subjectList, []);
        for (var i = 0; i < subjectList.length; i++) {
            if (subjectList[i]["DOCUMENTID"] + '' == id + '') {
                return subjectList[i]['subjectType'] + ' ' + subjectList[i]['CLIENT_FIO'];
            }
        }
    };

    options.subjectList = template.inputParams.subjectList || [];
    options.attachmentTypeParams =  {title: gRB('attachTypeTree'), STATEACCESSMODE: template.inputParams.STATEACCESSMODE, displayingTypesMap: template.inputParams.displayingTypesMap};
    options.uploadFlag = false;
    options.hideParticipantLink = template.inputParams.hideParticipantLink;

    options.onFileChange = function () {
        options.uploadFlag = false;
    };

    options.onFileUpload = function (p) {
        options.uploadFlag = true;
        options.uploadFile = p;
    };

    options.onFileInvalid = function () {
        options.uploadFlag = false;
        form.showErrorDialog(form.uploader.popover.error.content, function(){}, [{caption: gRB('dialog.OK')}])
    };

    options.cancel = function () {
        template[gridId].hideEditor();
        template.attachBtn.enable();
        template.data.isEnableButtonComplete = true;
        options.clearFields();
    };

    options.saveAttachment = function (){ console.log("saveAttachment");
            var uploadFile = options.uploadFile;
            var uploadFileType = options.attachmentType;
            var subject = options.subject;
            var attachmentType =  options.attachmentType;
            var objType = options.getTypeSysNameBySubject(options.subject);
            form.dsCall('[frontws2]', 'attachmentCreate', {
               // OBJTYPENAME: options.getTypeSysNameBySubject(options.subject),
                OBJTYPENAME: objType,
                OBJECTID: options.subject,
                ATTACHTYPENAME: options.attachmentType,
                ATTNAME: uploadFile.fileName,
                ATTFILEPATH: uploadFile.fileInfoId,
                ATTSIZE: uploadFile.fileSize,
                CREATIONDATE: new Date(),
                CONTENTTYPE: uploadFile.fileType,
                CREATEDBY: template.inputParams.USERFIO,
            }).then(function (resp) {
                if (resp.data.Status === 'OK'){ console.log("сохранение успешно");
                    options.uploadECM(subject, attachmentType);
                }
            }).catch(function (e) {
                form.showErrorDialog(gRB('errorOperationNotify')+'\n'+e.data.message, function () {}, [{caption:'OK'}])
            });
    };

    options.updateAttachment = function () {console.log("updateAttachment");
            var uploadFile = options.uploadFile;
            var uploadFileType = options.attachmentType;
            var subject = options.subject;
            var attachmentType =  options.attachmentType;
        //тут нужно начитать id старого документа в fileSystem и в есм
             form.dsCall('[frontws2]', 'attachmentGetListByParams', {
                  OBJECTIDS : (template.formParams.subjectType) ? [template.formParams.subjectType] : angular.copy(template.inputParams.OBJECTIDS || [0]),
                  CheckRights: true,
                  USERACCOUNTID: template.inputParams.USERACCOUNTID,
                  ATTACHTYPENAME: uploadFileType,
                  ORDERBY: "CREATIONDATE DESC",
             }).then(function (resp) {
                   if (resp.data.TOTALCOUNT != 0){ console.log("старый отчет найден"); console.log(resp);
                        var uploadFileID = resp.data.Result[0].ATTACHMENTID;  console.log("uploadFileID = " + uploadFileID);
                        var ecmFileID = resp.data.Result[0].ATTDOCNAME;       console.log("ecmFileID = " + ecmFileID);
                        var ATTNAME = resp.data.Result[0].ATTNAME;       console.log("ATTNAME = " + ATTNAME);   console.log("fileName = " + uploadFile.fileName);
                        console.log(uploadFileID);
                        form.dsCall('[frontws2]', 'attachmentModify', {
                               ATTACHMENTID: uploadFileID,
                               OBJTYPENAME: options.getTypeSysNameBySubject(options.subject),
                               OBJECTID: options.subject,
                               ATTACHTYPENAME: options.attachmentType,
                               //ATTNAME: uploadFile.fileName, наверно не надо обновлять
                               ATTDOCNAME: ecmFileID,
                               ATTFILEPATH: uploadFile.fileInfoId,
                               ATTSIZE: uploadFile.fileSize,
                               CREATIONDATE: new Date(),
                               CONTENTTYPE: uploadFile.fileType,
                               CREATEDBY: template.inputParams.USERFIO,
                        }).then(function (resp) {
                               if (resp.data.Status === 'OK'){ console.log("обновление успешно");
                                    options.updateECM(subject, attachmentType, ecmFileID, uploadFileID);
                                    //template.parentForm.action("REFRESH");
                               }
                        }).catch(function (e) {
                               form.showErrorDialog(gRB('errorOperationNotify')+'\n'+e.data.message, function () {}, [{caption:'OK'}])
                        });
                   }
                   else {  console.log("старый отчет НЕ найден");
                        options.saveAttachment();
                   }
             });
    };

    options.uploadECM = function (subject, attachmentType) { console.log("upload_ECM");
        var uploadFile = options.uploadFile;
        var projectSysname = form.getCurrentProjectSysname();
        var Loan_ID = subject;
        var pfd = '/COMMON/APPLICATION/ATTACHMENT/uploadECM';
        form.startModalPageFlowProcess(projectSysname+pfd, {
                ATTACHE_LIST: options.uploadFile,
                Document_type: attachmentType,
                DocumentName: uploadFile.fileName,
			    STORAGE: uploadFile.storage,
                Loan_ID: Loan_ID,
			    fileInfoId: uploadFile.fileInfoId,
			    needUpdate: "false"
        });
        template.parentForm.action("REFRESH");
        template[gridId].hideEditor();
        template.attachBtn.enable();
        template.data.isEnableButtonComplete = true;
        options.clearFields();
    };

    options.updateECM = function (subject, attachmentType, ecmFileID, uploadFileID) { console.log("update_ECM"); console.log("subject = " + subject); console.log("ecmFileID = " + ecmFileID); console.log("uploadFileID = " + uploadFileID);
        var uploadFile = options.uploadFile;
        var Loan_ID = subject;           console.log("Loan_ID = " + Loan_ID);
        var projectSysname = form.getCurrentProjectSysname();
        var pfd = '/COMMON/APPLICATION/ATTACHMENT/uploadECM';
        form.startModalPageFlowProcess(projectSysname+pfd, {
                ATTACHE_LIST: options.uploadFile,
                Document_type: attachmentType,
                DocumentName: uploadFile.fileName,
			    STORAGE: uploadFile.storage,
                Loan_ID: Loan_ID,
			    fileInfoId: uploadFile.fileInfoId,
			    uploadFileID: uploadFileID,
			    ecmFileID: ecmFileID,
			    needUpdate: true
        });
        template.parentForm.action("REFRESH");
        template[gridId].hideEditor();
        template.attachBtn.enable();
        template.data.isEnableButtonComplete = true;
        options.clearFields();
    };


    options.save = function () {  console.log("!!!SAVE!!!");
        var uploadFile = options.uploadFile;
        var uploadFileType = options.attachmentType;   console.log("uploadFileType = " + uploadFileType);
		var attFilePath = '';

        if(uploadFileType == 'BranchSignReport' || uploadFileType == 'UWOFristReport') {
             options.updateAttachment();
        }
        else {
            options.saveAttachment();
        }
    };

    options.clearFields = function () { console.log("clearFields");
        delete options.subject;
        delete options.attachmentType;
        delete options.fileUpload;
    };

    options.documentTypeReqMap = angular.copy(template.inputParams.documentTypeReqMap);

    options.getTypeSysNameBySubject = function(docId){ console.log("getTypeSysNameBySubject docId = " + docId);
        var subjectList = template.inputParams.subjectList || [];
        for (var i=0; i<subjectList.length; i++){  console.log("DOCTYPESYSNAME = " + subjectList[i]['DOCTYPESYSNAME']);
            if (subjectList[i]['DOCUMENTID'] === docId){
                return subjectList[i]['DOCTYPESYSNAME'];
            }
        }
        return null;
    };

    options.onChangeSubject = function (item) {
        obj.filterParams.OBJECTIDS = (item && item.DOCUMENTID) ? [item.DOCUMENTID] : angular.copy(template.inputParams.OBJECTIDS || [0]);
        template.formParams.subjectType = options.subjectType;
        template[gridId].refresh();
    };

    obj.options = options;
    obj.filterParams = {
        OBJECTIDS : (template.formParams.subjectType) ? [template.formParams.subjectType] : angular.copy(template.inputParams.OBJECTIDS || [0]),
        CheckRights: true,
        USERACCOUNTID: template.inputParams.USERACCOUNTID
    };
    options.subjectType = template.formParams.subjectType;
    //заменил на вызов dsCall
    // options.attachTypeObj = template.attachTypeObj;

    options.attachmentTypeChange = function(){
        if (template.fileUpload){
            template.fileUpload.clearValue();
        }
        if (options.attachmentType){
            form.dsCall("[frontws2]", "attachTypeGetByIdOrSysname", {
                SYSNAME: options.attachmentType
            }).then(
                function (p) {
                    p = p['data'];
                    if (p['Status'] == 'OK' && p['Result']) {
                        options.attachmentTypeMaxSize = p['Result']["MAXFILESIZE"] || undefined;
                        options.attachmentTypeMaskFile = p['Result']["MASKFILE"].length > 0 ? p['Result']["MASKFILE"] : undefined;
                    } else {
                        form.showWarningDialog(gRB('AttachmentList.errorDeleteAttachNotify'),function (){},[{caption: gRB('dialog.ok')}])
                    }
                })

        } else{
            options.attachmentTypeMaxSize = undefined;
            options.attachmentTypeMaskFile = undefined;
        }
    };

    obj.getSelectedRows = function (){
        return template[gridId].getSelectedRows();
    };

    obj.downloadAll = function(){
        template.data.parentForm.startModalPageFlowProcess(
            form.getCurrentProjectSysname()+'/COMMON/APPLICATION/ATTACHMENT/getAttachArchiveLink', {attachmentIDs: obj.getSelectedRows()}
        ).then(function(p){
            callBackFunction(p);
        })['catch'](function (result) {
            callBackFunction({Status:'ERROR'});
        });

        function callBackFunction(p) {
            if (p['HASHCODE']) {
                service.downloadFileByLink(p['HASHCODE']);
            } else {
                form.showWarningDialog(gRB('errorOperationNotify'),function (){},[{caption: gRB('dialog.ok')}])
            }
        }
    };

    obj.onAttach = function(){
        template[gridId].showEditor('add');
        template.attachBtn.disable();
        template.data.isEnableButtonComplete = false;
    };

    return obj;

})('attachTable');

template.onDeleteAttachment = function () {
    var item =template.attachTable.getSelectedRow()[0];
    if (item) {
        form.showQuestionDialog(
            gRB("AttachmentList.AttachDeleteConfirm"),
            function (idxData) {
                if (idxData.buttonIndex == 0) {
                    form.dsCall("[frontws2]", "attachmentDelete", {
                        ATTACHFILEDELETE: true,
                        ATTACHMENTID: item.ATTACHMENTID
                    }).then(
                        function (p) {
                            p = p['data'];
                            if (p['Status'] == 'OK') {
                                template.attachTable.setSelectedRow(undefined);
                                template.attachTable.refresh();
                                template.parentForm.action('REFRESH');
                            } else {
                                form.showWarningDialog(gRB('AttachmentList.errorDeleteAttachNotify'),function (){},[{caption: gRB('dialog.ok')}])
                            }
                        })

                }
            },
            [{caption: gRB('dialog.yes')}, {caption: gRB('dialog.cancel')}]
        )
    }
};

template.onCheckedRow = function (checked, item) {
    service.lgr(item);
    template.parentForm.selectedAttachements = item;
};

template.onSelectAttachment = function (item) {
    var STATEACCESSMODE = template.inputParams.STATEACCESSMODE;
    template.attachObj.options['ID' + item.ATTACHMENTID] = [];
    if ((item.ACCESSMODE != 'no' && item.ACCESSMODE != 'filter') && (STATEACCESSMODE == 'full' || STATEACCESSMODE == 'readonly' || STATEACCESSMODE == 'edit')){
        template.attachObj.options['ID' + item.ATTACHMENTID].push({
            caption: gRB('some.Download'),
            click: function(){
                template.onDownloadAttach(item)
            }
        })
    }

    if (template.editMode && (item.ACCESSMODE == 'full') && (STATEACCESSMODE == 'full' || STATEACCESSMODE == 'edit')){
        template.attachObj.options['ID' + item.ATTACHMENTID].push({
            caption: gRB('some.Delete'),
            click: template.onDeleteAttachment
        })
    }
};

template.onDownloadAttach = function () {
    var item = template.attachTable.getSelectedRow()[0];
    if (item.ACCESSMODE == 'no'){
        return;
    }
    form.startProcess(
        form.getCurrentProjectSysname()+'/COMMON/APPLICATION/ATTACHMENT/getAttachLink',
        {ATTFILEPATH: item.ATTFILEPATH, ATTNAME: item.ATTNAME, DOCTYPESYSNAME: item.OBJTYPENAME}
    ).then(function(r){
        callBackFunction(r);
    }).catch(function (r){
        callBackFunction({Status:'ERROR'});
    });

    function callBackFunction(p) {
        if (p['HASHCODE']) {
            service.downloadFileByLink(p['HASHCODE']);
        } else {
            form.showWarningDialog(gRB('errorOperationNotify'),function (){},[{caption: gRB('dialog.ok')}])
        }
    }
};

template.onDblClickAttachment = function (item) {
    template.attachTable.setSelectedRow(item[template.attachTable.itemIdField]);
    template.onDownloadAttach();
};

template.documentSingleUpload = function (reqDocMap) {
    if ((reqDocMap.ACCESSMODE === 'no' || reqDocMap.ACCESSMODE === 'readonly' || reqDocMap.ACCESSMODE === 'filter') && (reqDocMap.STATEACCESSMODE === 'full' || reqDocMap.STATEACCESSMODE === 'edit')) {
        form.showWarningDialog(gRB('AttachmentList.noRightDocType')+' «'+reqDocMap.ATTACHTYPEOTHERNAME+'»', function(){} ,[{caption: gRB("dialog.ok")}]);
        return;
    }
    if (reqDocMap.STATEACCESSMODE === 'no' || reqDocMap.STATEACCESSMODE === 'readonly') {
        form.showWarningDialog(gRB('AttachmentList.noRightDocType')+' «'+reqDocMap.ATTACHTYPEOTHERNAME+'» ' + gRB('AttachmentList.noRightState'), function(){} ,[{caption: gRB("dialog.ok")}]);
        return;
    }

    form.startModalPageFlowProcess(form.getCurrentProjectSysname() + '/COMMON/APPLICATION/documentSingleUpload', {
        docTypeMap: reqDocMap
    }).then(function (result) {
        if (result.uploadAction === 'OK') {
            var uploadFile = result.uploadFile;
            var projectSysname = form.getCurrentProjectSysname();
            var pfd = '/COMMON/APPLICATION/ATTACHMENT/uploadECM';
            form.startModalPageFlowProcess(projectSysname+pfd, {
                ATTACHE_LIST: uploadFile,
                Document_type: reqDocMap.ATTACHTYPENAME,
                DocumentName: uploadFile.fileName,
			    STORAGE: uploadFile.storage,
                Loan_ID: reqDocMap.DOCUMENTID,
			    fileInfoId: uploadFile.fileInfoId
                });
            template.parentForm.action("REFRESH");
        }
    });
};
// ===== إعدادات Google Sheets API =====
const SHEET_ID = '1oNOCyTUGiU0WkGSIWQUwmnhFWLO9p10jUamU_T0Q1Io';
const API_KEY = 'AIzaSyCp777fQc9NERZ8m-CTwBBuQuloovQ9p14';
let currentUser = null;
let currentRole = null;
let allData = {};

// ===== تهيئة البيانات =====
async function initializeApp() {
    try {
        await loadAllData();
        updateAllDropdowns();
        setCurrentDateTime();
    } catch (error) {
        console.error('خطأ في التهيئة:', error);
    }
}

// ===== تحميل جميع البيانات =====
async function loadAllData() {
    try {
        const sheets = ['Admins', 'Users', 'Areas', 'Branches', 'Cars', 'Drivers', 'Data'];

        for (let sheet of sheets) {
            const data = await getSheetData(sheet);
            allData[sheet] = data;
        }

        console.log('تم تحميل البيانات:', allData);
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        alert('خطأ في الاتصال بـ Google Sheet. يرجى التحقق من المفتاح والـ Sheet ID');
    }
}

// ===== الحصول على بيانات الصفحة =====
async function getSheetData(sheetName) {
    try {
        const range = `${sheetName}!A:Z`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!result.values) return [];

        const headers = result.values[0] || [];
        const rows = result.values.slice(1);

        return rows.map(row => {
            let obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = row[index] || '';
            });
            return obj;
        });
    } catch (error) {
        console.error(`خطأ في تحميل ${sheetName}:`, error);
        return [];
    }
}

// ===== إضافة صف جديد =====
async function addRowToSheet(sheetName, data) {
    try {
        const currentData = allData[sheetName] || [];
        const sheetHeaders = Object.keys(currentData[0] || {});

        if (sheetHeaders.length === 0) {
            sheetHeaders.push(...Object.keys(data));
        }

        const values = [sheetHeaders.map(h => data[h] || '')];

        const resource = {
            values: values
        };

        const range = `${sheetName}!A${currentData.length + 2}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resource)
        });

        if (!response.ok) {
            throw new Error('فشل في إضافة البيانات');
        }

        await loadAllData();
        return true;
    } catch (error) {
        console.error('خطأ:', error);
        alert('خطأ في حفظ البيانات. تأكد من الاتصال بالإنترنت.');
        return false;
    }
}

// ===== حذف صف =====
async function deleteRowFromSheet(sheetName, index) {
    try {
        // هذה تقتضي استخدام Sheets API مع بريد Gmail authenticated
        // لأغراض التطبيق، سنستخدم طريقة بديلة
        allData[sheetName].splice(index, 1);

        // إعادة كتابة الورقة بالكامل
        const range = `${sheetName}!A:Z`;
        const headers = Object.keys(allData[sheetName][0] || {});
        const values = [headers, ...allData[sheetName].map(row =>
            headers.map(h => row[h] || '')
        )];

        const resource = { values };
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resource)
        });

        if (!response.ok) throw new Error('خطأ');
        await loadAllData();
        return true;
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        return false;
    }
}

// ===== اختيار نوع المستخدم =====
function selectRole(role) {
    currentRole = role;
    document.getElementById('loginForm').style.display = 'flex';
    document.querySelector('.role-selection').style.display = 'none';
    document.getElementById('username').focus();
}

// ===== الرجوع للاختيار =====
function backToRoleSelection() {
    currentRole = null;
    document.getElementById('loginForm').style.display = 'none';
    document.querySelector('.role-selection').style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('errorMsg').style.display = 'none';
}

// ===== تسجيل الدخول =====
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');

    if (!username || !password) {
        errorMsg.textContent = 'يرجى ملء جميع الحقول';
        errorMsg.style.display = 'block';
        return;
    }

    const sheetName = currentRole === 'admin' ? 'Admins' : 'Users';
    const user = (allData[sheetName] || []).find(u =>
        u.name === username && u.password === password
    );

    if (!user) {
        errorMsg.textContent = 'بيانات غير صحيحة';
        errorMsg.style.display = 'block';
        return;
    }

    currentUser = username;
    errorMsg.style.display = 'none';

    if (currentRole === 'admin') {
        showPage('adminPanel');
        loadAdminData();
    } else {
        showPage('userPanel');
        updateAllDropdowns();
    }

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ===== تسجيل الخروج =====
function logout() {
    currentUser = null;
    currentRole = null;
    showPage('loginPage');
    backToRoleSelection();
}

// ===== عرض الصفحة =====
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName).classList.add('active');
}

// ===== تحميل بيانات الإدارة =====
function loadAdminData() {
    loadTable('usersTable', allData['Users'] || [], ['name', 'password']);
    loadTable('areasTable', allData['Areas'] || [], ['name']);
    loadTable('branchesTable', allData['Branches'] || [], ['name']);
    loadTable('carsTable', allData['Cars'] || [], ['number']);
    loadTable('driversTable', allData['Drivers'] || [], ['name']);
    loadTable('dataTable', allData['Data'] || [], ['supervisor_name', 'date_time', 'area', 'branch', 'car_number', 'driver_name', 'counter_out']);
}

// ===== تحميل الجدول =====
function loadTable(tableId, data, displayColumns) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    data.forEach((row, index) => {
        const tr = document.createElement('tr');

        displayColumns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = row[col] || '-';
            tr.appendChild(td);
        });

        // عمود الحذف
        const deleteTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '🗑️ حذف';
        deleteBtn.onclick = () => {
            if (confirm('هل تريد حذف هذا السجل؟')) {
                deleteRowFromSheet(getTableSheetName(tableId), index);
                loadAdminData();
            }
        };
        deleteTd.appendChild(deleteBtn);
        tr.appendChild(deleteTd);

        tbody.appendChild(tr);
    });
}

// ===== الحصول على اسم الصفحة من معرف الجدول =====
function getTableSheetName(tableId) {
    const mapping = {
        'usersTable': 'Users',
        'areasTable': 'Areas',
        'branchesTable': 'Branches',
        'carsTable': 'Cars',
        'driversTable': 'Drivers',
        'dataTable': 'Data'
    };
    return mapping[tableId];
}

// ===== إضافة مستخدم =====
async function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();

    if (!name || !password) {
        alert('يرجى ملء جميع الحقول');
        return;
    }

    const success = await addRowToSheet('Users', { name, password });
    if (success) {
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserPassword').value = '';
        loadAdminData();
        alert('تم إضافة المستخدم بنجاح');
    }
}

// ===== إضافة منطقة =====
async function addArea() {
    const name = document.getElementById('newAreaName').value.trim();

    if (!name) {
        alert('يرجى إدخال اسم المنطقة');
        return;
    }

    const success = await addRowToSheet('Areas', { name });
    if (success) {
        document.getElementById('newAreaName').value = '';
        loadAdminData();
        updateAllDropdowns();
        alert('تم إضافة المنطقة بنجاح');
    }
}

// ===== إضافة فرع =====
async function addBranch() {
    const name = document.getElementById('newBranchName').value.trim();

    if (!name) {
        alert('يرجى إدخال اسم الفرع');
        return;
    }

    const success = await addRowToSheet('Branches', { name });
    if (success) {
        document.getElementById('newBranchName').value = '';
        loadAdminData();
        updateAllDropdowns();
        alert('تم إضافة الفرع بنجاح');
    }
}

// ===== إضافة سيارة =====
async function addCar() {
    const number = document.getElementById('newCarNumber').value.trim();

    if (!number) {
        alert('يرجى إدخال رقم السيارة');
        return;
    }

    const success = await addRowToSheet('Cars', { number });
    if (success) {
        document.getElementById('newCarNumber').value = '';
        loadAdminData();
        updateAllDropdowns();
        alert('تم إضافة السيارة بنجاح');
    }
}

// ===== إضافة سائق =====
async function addDriver() {
    const name = document.getElementById('newDriverName').value.trim();

    if (!name) {
        alert('يرجى إدخال اسم السائق');
        return;
    }

    const success = await addRowToSheet('Drivers', { name });
    if (success) {
        document.getElementById('newDriverName').value = '';
        loadAdminData();
        updateAllDropdowns();
        alert('تم إضافة السائق بنجاح');
    }
}

// ===== تحديث جميع القوائم =====
function updateAllDropdowns() {
    updateSelect('areaSelect', allData['Areas'] || [], 'name');
    updateSelect('branchSelect', allData['Branches'] || [], 'name');
    updateSelect('carSelect', allData['Cars'] || [], 'number');
    updateSelect('driverSelect', allData['Drivers'] || [], 'name');
}

// ===== تحديث قائمة =====
function updateSelect(selectId, data, fieldName) {
    const select = document.getElementById(selectId);
    const currentValue = select.value;

    const options = select.querySelectorAll('option:not(:first-child)');
    options.forEach(opt => opt.remove());

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[fieldName];
        option.textContent = item[fieldName];
        select.appendChild(option);
    });

    select.value = currentValue;
}

// ===== تعيين التاريخ والوقت الحالي =====
function setCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const dateTimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
    document.getElementById('dateTime').value = dateTimeStr;
}

// ===== إرسال البيانات =====
async function submitData(event) {
    event.preventDefault();

    const area = document.getElementById('areaSelect').value;
    const branch = document.getElementById('branchSelect').value;
    const car = document.getElementById('carSelect').value;
    const driver = document.getElementById('driverSelect').value;
    const counter = document.getElementById('counterOut').value;
    const dateTime = document.getElementById('dateTime').value;

    if (!area || !branch || !car || !driver || !counter) {
        alert('يرجى ملء جميع الحقول');
        return;
    }

    const data = {
        supervisor_name: currentUser,
        date_time: dateTime,
        area: area,
        branch: branch,
        car_number: car,
        driver_name: driver,
        counter_out: counter
    };

    const success = await addRowToSheet('Data', data);
    if (success) {
        document.getElementById('successMsg').style.display = 'block';
        setTimeout(() => {
            document.getElementById('successMsg').style.display = 'none';
        }, 3000);

        event.target.reset();
        setCurrentDateTime();
    }
}

// ===== تصدير إلى CSV =====
function exportToCSV() {
    const data = allData['Data'] || [];
    if (data.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
    }

    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';

    data.forEach(row => {
        csv += headers.map(h => {
            const value = row[h] || '';
            return `"${value}"`;
        }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'fleet_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== تبديل التبويبات =====
function switchAdminTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

// ===== تهيئة التطبيق عند التحميل =====
window.addEventListener('DOMContentLoaded', initializeApp);

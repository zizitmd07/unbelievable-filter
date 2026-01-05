// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBd0jO-zVts8OUeQEiFu4xrlN_DR44xLI4",
    authDomain: "unbelievable-filter-7a71a.firebaseapp.com",
    databaseURL: "https://unbelievable-filter-7a71a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "unbelievable-filter-7a71a",
    storageBucket: "unbelievable-filter-7a71a.firebasestorage.app",
    messagingSenderId: "840999077122",
    appId: "1:840999077122:web:f2f6c2d18654b09f4eae1b"
};

let inventoryData = [];
let historyData = [];
let db = null;
let isFirebaseEnabled = false;

// Firebase 초기화
function initFirebase() {
    try {
        if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            isFirebaseEnabled = true;
            updateSyncStatus('online', 'Firebase 연결됨');
            loadFromFirebase();
        } else {
            isFirebaseEnabled = false;
            updateSyncStatus('offline', '로컬 모드');
            loadFromLocalStorage();
        }
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
        isFirebaseEnabled = false;
        updateSyncStatus('offline', '로컬 모드');
        loadFromLocalStorage();
    }
}

// 동기화 상태 업데이트
function updateSyncStatus(status, text) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatus');
    
    if (status === 'online') {
        indicator.classList.remove('offline');
    } else {
        indicator.classList.add('offline');
    }
    
    statusText.textContent = text;
}

// Firebase에서 데이터 로드
function loadFromFirebase() {
    if (!isFirebaseEnabled) return;
    
    updateSyncStatus('online', '동기화 중...');
    
    db.ref('inventory').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            inventoryData = Object.values(data);
            displayInventory();
            updateSyncStatus('online', '동기화 완료');
        }
    });
    
    db.ref('history').limitToLast(100).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            historyData = Object.values(data).reverse();
            displayHistory();
        }
    });
}

// Firebase에 데이터 저장
function saveToFirebase() {
    if (!isFirebaseEnabled) {
        saveToLocalStorage();
        return;
    }
    
    updateSyncStatus('online', '저장 중...');
    
    const inventoryObj = {};
    inventoryData.forEach((item, index) => {
        inventoryObj[`item_${index}`] = item;
    });
    
    db.ref('inventory').set(inventoryObj)
        .then(() => {
            updateSyncStatus('online', '저장 완료');
            setTimeout(() => updateSyncStatus('online', 'Firebase 연결됨'), 1000);
        })
        .catch((error) => {
            console.error('저장 실패:', error);
            updateSyncStatus('offline', '저장 실패');
        });
}

// Firebase에 이력 추가
function addHistoryToFirebase(record) {
    if (!isFirebaseEnabled) {
        saveToLocalStorage();
        return;
    }
    
    const newRecordRef = db.ref('history').push();
    newRecordRef.set(record)
        .catch((error) => {
            console.error('이력 저장 실패:', error);
        });
}

// 로컬 스토리지에서 데이터 로드
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('filterInventoryData');
    const savedHistory = localStorage.getItem('filterInventoryHistory');
    
    if (savedData) {
        inventoryData = JSON.parse(savedData);
        displayInventory();
        showMessage('로컬 데이터를 불러왔습니다.', 'info');
    }
    
    if (savedHistory) {
        historyData = JSON.parse(savedHistory);
        displayHistory();
    }
}

// 로컬 스토리지에 데이터 저장
function saveToLocalStorage() {
    localStorage.setItem('filterInventoryData', JSON.stringify(inventoryData));
    localStorage.setItem('filterInventoryHistory', JSON.stringify(historyData));
}

// 페이지 로드 시 초기화
window.onload = function() {
    initFirebase();
    setupDragAndDrop();
    setupFileInput();
};

// 드래그 앤 드롭 설정
function setupDragAndDrop() {
    const uploadSection = document.getElementById('uploadSection');
    
    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });

    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('dragover');
    });

    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// 파일 입력 설정
function setupFileInput() {
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });
}

// 파일 처리
function handleFile(file) {
    const reader = new FileReader();
    
    showMessage('파일 처리 중...', 'info');
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
            
            parseExcelData(jsonData);
            showMessage('✅ 엑셀 파일이 성공적으로 업로드되었습니다!', 'success');
        } catch (error) {
            showMessage('❌ 파일 처리 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 엑셀 데이터 파싱
function parseExcelData(data) {
    inventoryData = [];
    
    let headerIndex = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i].length > 0 && data[i][0]) {
            headerIndex = i;
            break;
        }
    }
    
    const headers = data[headerIndex];
    
    let codeIndex = -1, nameIndex = -1, stockIndex = -1, physicalIndex = -1;
    
    headers.forEach((header, index) => {
        const h = String(header).trim().toLowerCase();
        if (h.includes('자재코드') || h.includes('코드')) codeIndex = index;
        if (h.includes('품명') || h.includes('규격')) nameIndex = index;
        if (h.includes('지국전체') || h.includes('현재고')) stockIndex = index;
        if (h.includes('실물필터') || h.includes('실물')) physicalIndex = index;
    });
    
    for (let i = headerIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (row.length === 0 || !row[codeIndex]) continue;
        
        inventoryData.push({
            자재코드: String(row[codeIndex] || '').trim(),
            품명및규격: String(row[nameIndex] || '').trim(),
            지국전체현재고: parseInt(row[stockIndex]) || 0,
            실물필터: parseInt(row[physicalIndex]) || 0
        });
    }
    
    if (inventoryData.length > 0) {
        displayInventory();
        saveToFirebase();
    } else {
        showMessage('❌ 유효한 데이터를 찾을 수 없습니다. 엑셀 파일 형식을 확인해주세요.', 'error');
    }
}

// 재고 현황 표시
function displayInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    
    inventoryData.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.자재코드}</td>
            <td>${item.품명및규격}</td>
            <td>${item.지국전체현재고.toLocaleString()}</td>
            <td>${item.실물필터.toLocaleString()}</td>
        `;
    });
    
    updateStats();
    showUI();
}

// 통계 업데이트
function updateStats() {
    const totalItems = inventoryData.length;
    const totalStock = inventoryData.reduce((sum, item) => sum + item.지국전체현재고, 0);
    const totalPhysical = inventoryData.reduce((sum, item) => sum + item.실물필터, 0);
    
    document.getElementById('totalItems').textContent = totalItems.toLocaleString();
    document.getElementById('totalStock').textContent = totalStock.toLocaleString();
    document.getElementById('totalPhysical').textContent = totalPhysical.toLocaleString();
}

// UI 표시
function showUI() {
    document.getElementById('tableContainer').classList.remove('hidden');
    document.getElementById('controlPanel').classList.remove('hidden');
    document.getElementById('historySection').classList.remove('hidden');
    document.getElementById('shareSection').classList.remove('hidden');
    document.getElementById('statsContainer').classList.remove('hidden');
    document.getElementById('searchBox').classList.remove('hidden');
}

// 입출고 처리
function processTransaction() {
    const actionType = document.getElementById('actionType').value;
    const searchType = document.getElementById('searchType').value;
    const searchValue = document.getElementById('searchValue').value.trim();
    const stockType = document.getElementById('stockType').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    
    if (!searchValue) {
        showMessage('❌ 검색 값을 입력해주세요.', 'error');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showMessage('❌ 올바른 수량을 입력해주세요.', 'error');
        return;
    }
    
    const searchKey = searchType === '자재코드' ? '자재코드' : '품명및규격';
    const itemIndex = inventoryData.findIndex(item => 
        item[searchKey].toLowerCase().includes(searchValue.toLowerCase())
    );
    
    if (itemIndex === -1) {
        showMessage('❌ 해당 항목을 찾을 수 없습니다.', 'error');
        return;
    }
    
    const item = inventoryData[itemIndex];
    const oldValue = item[stockType];
    
    if (actionType === '입고') {
        item[stockType] += quantity;
    } else {
        if (item[stockType] < quantity) {
            showMessage(`❌ 재고가 부족합니다. 현재 재고: ${item[stockType]}`, 'error');
            return;
        }
        item[stockType] -= quantity;
    }
    
    const timestamp = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const record = {
        timestamp: timestamp,
        action: actionType,
        item: item.품명및규격,
        code: item.자재코드,
        stockType: stockType === '지국전체현재고' ? '지국전체 현재고' : '실물필터',
        quantity: quantity,
        oldValue: oldValue,
        newValue: item[stockType]
    };
    
    historyData.unshift(record);
    
    displayInventory();
    displayHistory();
    
    if (isFirebaseEnabled) {
        saveToFirebase();
        addHistoryToFirebase(record);
    } else {
        saveToLocalStorage();
    }
    
    document.getElementById('searchValue').value = '';
    document.getElementById('quantity').value = '1';
    
    showMessage(`✅ ${actionType} 처리가 완료되었습니다. (${item.품명및규격})`, 'success');
}

// 이력 표시
function displayHistory() {
    const historyList = document.getElementById('historyList');
    
    if (historyData.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999;">아직 이력이 없습니다.</p>';
        return;
    }
    
    historyList.innerHTML = '';
    historyData.slice(0, 50).forEach(record => {
        const div = document.createElement('div');
        div.className = `history-item ${record.action}`;
        div.innerHTML = `
            <div class="timestamp">${record.timestamp}</div>
            <div class="details">
                <strong>${record.action}</strong> | ${record.item} (${record.code})<br>
                ${record.stockType}: ${record.oldValue.toLocaleString()} → ${record.newValue.toLocaleString()} 
                (${record.action === '입고' ? '+' : '-'}${record.quantity.toLocaleString()})
            </div>
        `;
        historyList.appendChild(div);
    });
}

// 테이블 검색
function filterTable() {
    const searchText = document.getElementById('tableSearch').value.toLowerCase();
    const tbody = document.getElementById('inventoryTableBody');
    const rows = tbody.getElementsByTagName('tr');
    
    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    }
}

// 데이터 초기화
function resetData() {
    if (!confirm('⚠️ 정말로 모든 데이터를 초기화하시겠습니까?\n(저장된 재고 및 이력이 모두 삭제됩니다)')) {
        return;
    }
    
    inventoryData = [];
    historyData = [];
    
    if (isFirebaseEnabled) {
        db.ref('inventory').remove();
        db.ref('history').remove();
        updateSyncStatus('online', 'Firebase 연결됨');
    } else {
        localStorage.removeItem('filterInventoryData');
        localStorage.removeItem('filterInventoryHistory');
    }
    
    document.getElementById('inventoryTableBody').innerHTML = '';
    document.getElementById('historyList').innerHTML = '<p style="text-align: center; color: #999;">아직 이력이 없습니다.</p>';
    
    document.getElementById('tableContainer').classList.add('hidden');
    document.getElementById('controlPanel').classList.add('hidden');
    document.getElementById('historySection').classList.add('hidden');
    document.getElementById('shareSection').classList.add('hidden');
    document.getElementById('statsContainer').classList.add('hidden');
    document.getElementById('searchBox').classList.add('hidden');
    
    showMessage('🔄 데이터가 초기화되었습니다.', 'info');
}

// URL 공유
function shareURL() {
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: '언블리버블 필터 - 재고관리',
            text: '필터 재고 관리 시스템을 공유합니다',
            url: url
        }).then(() => {
            showMessage('✅ 공유되었습니다!', 'success');
        }).catch((error) => {
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showMessage('✅ URL이 클립보드에 복사되었습니다!', 'success');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showMessage('✅ URL이 클립보드에 복사되었습니다!', 'success');
    }
}

// 엑셀 다운로드
function exportToExcel() {
    if (inventoryData.length === 0) {
        showMessage('❌ 다운로드할 데이터가 없습니다.', 'error');
        return;
    }
    
    const ws_data = [
        ['자재코드', '품명 및 규격', '지국전체 현재고', '실물필터']
    ];
    
    inventoryData.forEach(item => {
        ws_data.push([
            item.자재코드,
            item.품명및규격,
            item.지국전체현재고,
            item.실물필터
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    ws['!cols'] = [
        { wch: 15 },
        { wch: 40 },
        { wch: 18 },
        { wch: 15 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, '재고현황');
    
    const timestamp = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `언블리버블필터_재고_${timestamp}.xlsx`);
    
    showMessage('✅ 엑셀 파일이 다운로드되었습니다!', 'success');
}

// 메시지 표시
function showMessage(text, type) {
    const messageArea = document.getElementById('messageArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    messageArea.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.transition = 'opacity 0.3s';
        messageDiv.style.opacity = '0';
        setTimeout(() => messageDiv.remove(), 300);
    }, 4000);
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('tableSearch').focus();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        processTransaction();
    }
});

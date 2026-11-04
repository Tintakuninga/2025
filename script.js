// =====================================================================
// 1. IMPORT FIREBASE SDK (Versi 10 Modular)
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================================================================
// 2. KONFIGURASI FIREBASE
// =====================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBviMbX_-VMr7RkObmsqN_6Y2skAOdIQkQ",
    authDomain: "logbook-map-43835.firebaseapp.com",
    projectId: "logbook-map-43835",
    storageBucket: "logbook-map-43835.firebasestorage.app",
    messagingSenderId: "278957351659",
    appId: "1:278957351659:web:5005eba610fc14c7c614ae",
    measurementId: "G-1R24FJLL89"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Global Variabel
let customers = [];

document.addEventListener('DOMContentLoaded', () => {

    // =====================================================================
    // 3. AUTENTIKASI LOGIN & HAK AKSES (ROLE)
    // =====================================================================
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    const loginError = document.getElementById('loginError');

    // Tombol Login Google
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                loginError.style.display = "block";
                loginError.innerText = "Gagal login: " + error.message;
            }
        });
    }

    // Cek Status Login User
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Cek role di Firestore
            const userDocRef = doc(db, "pengguna", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let role = "user"; 

            if (!userDocSnap.exists()) {
                // User baru pertama kali login, simpan sebagai 'user'
                await setDoc(userDocRef, {
                    nama: user.displayName,
                    email: user.email,
                    role: "user",
                    createdAt: new Date().toISOString()
                });
            } else {
                role = userDocSnap.data().role;
            }

            if (role === "admin") {
                // MASUK SEBAGAI ADMIN
                if(loginScreen) loginScreen.style.display = "none";
                if(appContent) appContent.style.display = "flex";
                
                // Update Profil di Sidebar
                const userNameEl = document.querySelector('.user-name');
                const userIdEl = document.querySelector('.user-id');
                if(userNameEl) userNameEl.innerText = user.displayName;
                if(userIdEl) userIdEl.innerText = "Admin Pangkalan";
                
                // Load data utama
                loadCustomers();
                loadInventaris();
                loadHarga();
            } else {
                // MASUK SEBAGAI USER / PELANGGAN
                if(loginScreen) {
                    loginScreen.innerHTML = `
                        <div class="login-card">
                            <h2>Halo, ${user.displayName}</h2>
                            <p>Anda saat ini login sebagai <b>Pengguna</b>.<br><br>Halaman khusus smartphone untuk pelanggan masih dalam tahap pengembangan.</p>
                            <button class="btn-danger" id="btnTempLogout" style="width:100%; padding:10px; border-radius:6px; cursor:pointer;">Keluar / Ganti Akun</button>
                        </div>`;
                    document.getElementById('btnTempLogout').addEventListener('click', () => signOut(auth));
                }
            }
        } else {
            // TIDAK ADA YANG LOGIN (LOGOUT)
            if(loginScreen) loginScreen.style.display = "flex";
            if(appContent) appContent.style.display = "none";
            // Jika ada perubahan HTML di login screen akibat role user, refresh agar kembali normal
            if (loginScreen && loginScreen.innerHTML.includes('Halo,')) {
                location.reload(); 
            }
        }
    });

    // Tombol Keluar (Exit) di Sidebar
    const btnExit = document.querySelector('.btn-exit');
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            showConfirm("Yakin ingin keluar dari sistem?", async () => {
                try {
                    await signOut(auth);
                } catch (error) {
                    showAlert("Gagal keluar dari sistem.");
                }
            });
        });
    }

    // =====================================================================
    // 4. UI LOGIC & TEMA
    // =====================================================================
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
    
    // Cek preferensi tema di LocalStorage
    if (localStorage.getItem('lpg_theme') === 'light') {
        document.body.classList.add('light-theme');
        if(themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            if (isLight) {
                if(themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
                localStorage.setItem('lpg_theme', 'light');
            } else {
                if(themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
                localStorage.setItem('lpg_theme', 'dark');
            }
        });
    }

    // Toggle Sidebar
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }

    // Navigasi Menu Sidebar
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if(item.classList.contains('btn-exit')) return; // Abaikan tombol exit
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === target) sec.classList.add('active');
            });
        });
    });

    // =====================================================================
    // 5. UTILITY & FUNGSI GLOBAL (MODAL, ALERT)
    // =====================================================================
    window.showAlert = function(message) {
        document.getElementById('alertMessage').innerText = message;
        document.getElementById('alertModal').style.display = "flex";
    };

    window.closeModal = function(modalId) {
        document.getElementById(modalId).style.display = "none";
    };

    let confirmCallback = null;
    window.showConfirm = function(message, callback) {
        document.getElementById('confirmMessage').innerText = message;
        document.getElementById('confirmModal').style.display = "flex";
        confirmCallback = callback;
    };

    document.getElementById('btnConfirmYes').addEventListener('click', () => {
        closeModal('confirmModal');
        if(confirmCallback) confirmCallback();
    });

    // Format Input Rupiah
    function formatRupiah(value) {
        let number_string = value.toString().replace(/[^,\d]/g, '');
        let split = number_string.split(',');
        let sisa = split[0].length % 3;
        let rupiah = split[0].substr(0, sisa);
        let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
        if (ribuan) {
            let separator = sisa ? '.' : '';
            rupiah += separator + ribuan.join('.');
        }
        return split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
    }

    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', function() {
            this.value = formatRupiah(this.value);
        });
    });

    // Format Tanggal
    function formatTanggal(dateString) {
        if(!dateString) return "-";
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // =====================================================================
    // 6. LOGIC DATA PELANGGAN (CRUD FIRESTORE)
    // =====================================================================
    const tableBody = document.getElementById('customerTableBody');
    const customerForm = document.getElementById('customerForm');
    const nikInput = document.getElementById('nik');
    const nikError = document.getElementById('nikError');

    // Validasi NIK 16 digit saat mengetik
    if(nikInput) {
        nikInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, ''); // Hanya angka
            if(this.value.length !== 16 && this.value.length > 0) {
                nikError.style.display = "block";
                this.style.borderColor = "var(--danger-color)";
            } else {
                nikError.style.display = "none";
                this.style.borderColor = "var(--border-color)";
            }
        });
    }

    function updateStats() {
        if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = customers.length;
        if(document.getElementById('stat-rt')) document.getElementById('stat-rt').innerText = customers.filter(c => c.status === 'Rumah Tangga').length;
        if(document.getElementById('stat-um')) document.getElementById('stat-um').innerText = customers.filter(c => c.status === 'Usaha Mikro').length;
        if(document.getElementById('stat-pt')) document.getElementById('stat-pt').innerText = customers.filter(c => c.status === 'Petani Sasaran').length;
        if(document.getElementById('stat-nl')) document.getElementById('stat-nl').innerText = customers.filter(c => c.status === 'Nelayan Sasaran').length;
    }

    function renderTable() {
        if(!tableBody) return;
        tableBody.innerHTML = '';
        customers.forEach((c, index) => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-rt';
            if(c.status === 'Usaha Mikro') badgeClass = 'badge-um';
            else if(c.status === 'Petani Sasaran') badgeClass = 'badge-pt';
            else if(c.status === 'Nelayan Sasaran') badgeClass = 'badge-nl';

            tr.innerHTML = `
                <td><strong>${c.nik}</strong></td>
                <td>${c.nama}</td>
                <td><span class="badge-status ${badgeClass}">${c.status}</span></td>
                <td>${c.tempat_lahir}</td>
                <td>${formatTanggal(c.tanggal_lahir)}</td>
                <td>
                    <button class="btn-edit" onclick="editCustomer(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-danger" onclick="deleteCustomer(${index})" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        updateStats();
    }

    async function loadCustomers() {
        customers = [];
        const querySnapshot = await getDocs(collection(db, "pelanggan"));
        querySnapshot.forEach((doc) => {
            customers.push({ id: doc.id, ...doc.data() });
        });
        renderTable();
    }

    const btnAddData = document.getElementById('btnAddData');
    if(btnAddData) {
        btnAddData.addEventListener('click', () => {
            customerForm.reset();
            nikError.style.display = "none";
            nikInput.style.borderColor = "var(--border-color)";
            document.getElementById('editIndex').value = "-1";
            document.getElementById('modalTitle').innerText = "Tambah Data Pelanggan";
            document.getElementById('formModal').style.display = "flex";
        });
    }

    if(customerForm) {
        customerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nikVal = nikInput.value;
            if(nikVal.length !== 16) {
                showAlert("Gagal Menyimpan! NIK harus persis 16 digit.");
                return;
            }

            const index = document.getElementById('editIndex').value;
            const data = {
                nik: nikVal,
                nama: document.getElementById('nama').value,
                status: document.getElementById('status').value,
                tempat_lahir: document.getElementById('tempat_lahir').value,
                tanggal_lahir: document.getElementById('tanggal_lahir').value
            };

            try {
                if (index === "-1") {
                    await addDoc(collection(db, "pelanggan"), data);
                } else {
                    const docId = customers[index].id;
                    await updateDoc(doc(db, "pelanggan", docId), data);
                }
                await loadCustomers();
                closeModal('formModal');
                showAlert("Data Pelanggan berhasil disimpan di Cloud!");
            } catch (error) {
                console.error("Error saving document: ", error);
                showAlert("Terjadi kesalahan saat menyimpan data.");
            }
        });
    }

    window.editCustomer = (index) => {
        const c = customers[index];
        document.getElementById('editIndex').value = index;
        document.getElementById('nik').value = c.nik;
        document.getElementById('nama').value = c.nama;
        document.getElementById('status').value = c.status;
        document.getElementById('tempat_lahir').value = c.tempat_lahir;
        document.getElementById('tanggal_lahir').value = c.tanggal_lahir;
        document.getElementById('modalTitle').innerText = "Edit Data Pelanggan";
        document.getElementById('formModal').style.display = "flex";
    };

    window.deleteCustomer = (index) => {
        showConfirm("Yakin ingin menghapus data pelanggan ini dari Cloud?", async () => {
            const docId = customers[index].id;
            try {
                await deleteDoc(doc(db, "pelanggan", docId));
                await loadCustomers();
                showAlert("Data berhasil dihapus dari Cloud.");
            } catch (error) {
                console.error("Error deleting document: ", error);
                showAlert("Gagal menghapus data.");
            }
        });
    };

    // =====================================================================
    // 7. LOGIC DATA INVENTARIS & HARGA
    // =====================================================================
    async function loadInventaris() {
        const docRef = doc(db, "settings", "inventaris");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const invData = docSnap.data();
            if(document.getElementById('inv3kg') && invData['3kg']) document.getElementById('inv3kg').value = invData['3kg'];
            if(document.getElementById('inv5kg') && invData['5kg']) document.getElementById('inv5kg').value = invData['5kg'];
            if(document.getElementById('inv12kg') && invData['12kg']) document.getElementById('inv12kg').value = invData['12kg'];
            if(document.getElementById('invLastUpdate') && invData['lastUpdated']) {
                document.getElementById('invLastUpdate').innerText = new Date(invData['lastUpdated']).toLocaleString('id-ID');
            }
        }
    }

    async function loadHarga() {
        const docRef = doc(db, "settings", "harga");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const priceData = docSnap.data();
            if (priceData.modal && document.getElementById('mRefill3')) {
                document.getElementById('mRefill3').value = formatRupiah(priceData.modal.refill['3kg'] || '');
                document.getElementById('mRefill5').value = formatRupiah(priceData.modal.refill['5kg'] || '');
                document.getElementById('mRefill12').value = formatRupiah(priceData.modal.refill['12kg'] || '');
                document.getElementById('mFull3').value = formatRupiah(priceData.modal.full['3kg'] || '');
                document.getElementById('mFull5').value = formatRupiah(priceData.modal.full['5kg'] || '');
                document.getElementById('mFull12').value = formatRupiah(priceData.modal.full['12kg'] || '');
            }
            if (priceData.jual && document.getElementById('jRefill3')) {
                document.getElementById('jRefill3').value = formatRupiah(priceData.jual.refill['3kg'] || '');
                document.getElementById('jRefill5').value = formatRupiah(priceData.jual.refill['5kg'] || '');
                document.getElementById('jRefill12').value = formatRupiah(priceData.jual.refill['12kg'] || '');
                document.getElementById('jFull3').value = formatRupiah(priceData.jual.full['3kg'] || '');
                document.getElementById('jFull5').value = formatRupiah(priceData.jual.full['5kg'] || '');
                document.getElementById('jFull12').value = formatRupiah(priceData.jual.full['12kg'] || '');
            }
            if(document.getElementById('priceLastUpdate') && priceData.lastUpdated) {
                document.getElementById('priceLastUpdate').innerText = new Date(priceData.lastUpdated).toLocaleString('id-ID');
            }
        }
    }

    const formInventaris = document.getElementById('formInventaris');
    if(formInventaris) {
        formInventaris.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                '3kg': document.getElementById('inv3kg').value,
                '5kg': document.getElementById('inv5kg').value,
                '12kg': document.getElementById('inv12kg').value,
                'lastUpdated': new Date().toISOString()
            };
            try {
                await setDoc(doc(db, "settings", "inventaris"), data);
                document.getElementById('invLastUpdate').innerText = new Date(data.lastUpdated).toLocaleString('id-ID');
                showAlert("Data inventaris berhasil disimpan di Cloud!");
            } catch (error) {
                console.error("Error saving inventory: ", error);
            }
        });
    }

    const formHarga = document.getElementById('formHarga');
    if(formHarga) {
        formHarga.addEventListener('submit', async (e) => {
            e.preventDefault();
            const stripDots = (val) => val.replace(/\./g, '');
            const data = {
                modal: {
                    refill: {
                        '3kg': stripDots(document.getElementById('mRefill3').value),
                        '5kg': stripDots(document.getElementById('mRefill5').value),
                        '12kg': stripDots(document.getElementById('mRefill12').value)
                    },
                    full: {
                        '3kg': stripDots(document.getElementById('mFull3').value),
                        '5kg': stripDots(document.getElementById('mFull5').value),
                        '12kg': stripDots(document.getElementById('mFull12').value)
                    }
                },
                jual: {
                    refill: {
                        '3kg': stripDots(document.getElementById('jRefill3').value),
                        '5kg': stripDots(document.getElementById('jRefill5').value),
                        '12kg': stripDots(document.getElementById('jRefill12').value)
                    },
                    full: {
                        '3kg': stripDots(document.getElementById('jFull3').value),
                        '5kg': stripDots(document.getElementById('jFull5').value),
                        '12kg': stripDots(document.getElementById('jFull12').value)
                    }
                },
                lastUpdated: new Date().toISOString()
            };
            
            try {
                await setDoc(doc(db, "settings", "harga"), data);
                document.getElementById('priceLastUpdate').innerText = new Date(data.lastUpdated).toLocaleString('id-ID');
                showAlert("Daftar Harga berhasil disimpan di Cloud!");
            } catch (error) {
                console.error("Error saving prices: ", error);
            }
        });
    }
});
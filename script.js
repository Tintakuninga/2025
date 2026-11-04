// =====================================================================
// 1. IMPORT FIREBASE SDK (Versi 10 Modular)
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
                await setDoc(userDocRef, {
                    nama: user.displayName,
                    email: user.email,
                    role: "user",
                    createdAt: new Date().toISOString()
                });

                // Kirim notifikasi pendaftaran pengguna baru ke sistem
                try {
                    await addDoc(collection(db, "notifikasi"), {
                        judul: "Pengguna Baru Mendaftar",
                        pesan: `${user.displayName} (${user.email}) telah bergabung ke aplikasi.`,
                        isRead: false,
                        timestamp: new Date()
                    });
                } catch (err) {
                    console.error("Gagal mengirim notifikasi:", err);
                }
            } else {
                role = userDocSnap.data().role;
            }

            if (role === "admin") {
                if(loginScreen) loginScreen.style.display = "none";
                if(appContent) appContent.style.display = "flex";
                
                document.querySelectorAll('.user-name').forEach(el => el.innerText = user.displayName);
                document.querySelectorAll('.user-email').forEach(el => el.innerText = user.email);
                
                const initial = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'A';
                document.querySelectorAll('.user-initial, .avatar-circle').forEach(el => el.innerText = initial);

                const userIdEl = document.querySelector('.user-id');
                if(userIdEl) userIdEl.innerText = "Admin Pangkalan";
                
                loadCustomers();
                loadInventaris();
                loadHarga();
                listenToNotifications();
            } else {
                window.location.href = "./user/";
            }
        } else {
            if(loginScreen) loginScreen.style.display = "flex";
            if(appContent) appContent.style.display = "none";
            if (loginScreen && loginScreen.innerHTML.includes('Halo,')) {
                location.reload(); 
            }
        }
    });

    // Tombol Keluar (Exit) di Sidebar
    const btnExit = document.querySelector('.btn-exit');
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            document.getElementById('modalLogout').style.display = "flex";
        });
    }

    // Konfirmasi Logout pada Modal Khusus
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');
    if(btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', async () => {
            closeModal('modalLogout');
            try {
                await signOut(auth);
            } catch (error) {
                showAlert("Gagal keluar dari sistem.", "Gagal", "error");
            }
        });
    }

    // =====================================================================
    // 4. UI LOGIC & TEMA
    // =====================================================================
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
    
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
            if(item.classList.contains('btn-exit')) return;
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
    // 5. UTILITY & FUNGSI GLOBAL MODAL KUSTOM
    // =====================================================================
    window.showAlert = function(message, title = "Informasi", type = "info") {
        const modal = document.getElementById('alertModal');
        const alertMsg = document.getElementById('alertMessage');
        const alertIcon = document.getElementById('alertIcon');
        const alertHeader = modal ? modal.querySelector('h3') : null;

        if (modal && alertMsg) {
            alertMsg.innerText = message;
            if (alertHeader) alertHeader.innerText = title;

            // Kustomisasi Icon & Warna sesuai jenis pesan
            if (alertIcon) {
                if (type === "error") {
                    alertIcon.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
                    alertIcon.style.color = "var(--danger-color)";
                } else if (type === "success") {
                    alertIcon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                    alertIcon.style.color = "var(--green-color)";
                } else if (type === "warning") {
                    alertIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
                    alertIcon.style.color = "#f97316";
                } else {
                    alertIcon.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
                    alertIcon.style.color = "var(--accent-blue)";
                }
            }
            modal.style.display = "flex";
        } else {
            console.log(`[${title}] ${message}`);
        }
    };

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
    };

    let confirmCallback = null;
    window.showConfirm = function(message, callback) {
        const confirmMsg = document.getElementById('confirmMessage');
        const confirmModal = document.getElementById('confirmModal');
        if (confirmMsg && confirmModal) {
            confirmMsg.innerText = message;
            confirmModal.style.display = "flex";
            confirmCallback = callback;
        }
    };

    const btnConfirmYes = document.getElementById('btnConfirmYes');
    if (btnConfirmYes) {
        btnConfirmYes.addEventListener('click', () => {
            closeModal('confirmModal');
            if (confirmCallback) confirmCallback();
        });
    }

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
    // 6. LOGIC DATA PELANGGAN (CRUD FIRESTORE & VALIDASI NIK)
    // =====================================================================
    const tableBody = document.getElementById('customerTableBody');
    const customerForm = document.getElementById('customerForm');
    const nikInput = document.getElementById('nik');
    const nikError = document.getElementById('nikError');

    if(nikInput) {
        nikInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
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

    if (customerForm) {
        customerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nikVal = nikInput.value.trim();
            const index = document.getElementById('editIndex').value;

            // 1. Validasi NIK 16 Digit
            if (nikVal.length !== 16 || isNaN(nikVal)) {
                showAlert("Gagal Menyimpan! NIK harus persis 16 digit angka.", "Peringatan", "warning");
                return;
            }

            // 2. Validasi Tanggal/Bulan Lahir Dukcapil
            const dd = parseInt(nikVal.substring(6, 8), 10);
            const mm = parseInt(nikVal.substring(8, 10), 10);

            if (mm < 1 || mm > 12) {
                showAlert("Gagal Menyimpan! Format NIK tidak valid (bulan lahir pada digit ke-9 & 10 salah).", "Peringatan", "warning");
                return;
            }

            const isValidHari = (dd >= 1 && dd <= 31) || (dd >= 41 && dd <= 71);
            if (!isValidHari) {
                showAlert("Gagal Menyimpan! Format NIK tidak valid (tanggal lahir pada digit ke-7 & 8 salah).", "Peringatan", "warning");
                return;
            }

            // 3. Validasi Duplikasi NIK di Cloud
            try {
                const qNik = query(collection(db, "pelanggan"), where("nik", "==", nikVal));
                const querySnap = await getDocs(qNik);

                if (index === "-1") {
                    if (!querySnap.empty) {
                        showAlert(`Gagal Menyimpan! NIK ${nikVal} sudah terdaftar di sistem.`, "NIK Duplikat", "error");
                        return;
                    }
                } else {
                    const docIdCurrent = customers[index].id;
                    const isDuplicate = querySnap.docs.some(docItem => docItem.id !== docIdCurrent);
                    if (isDuplicate) {
                        showAlert(`Gagal Menyimpan! NIK ${nikVal} sudah digunakan oleh pelanggan lain.`, "NIK Duplikat", "error");
                        return;
                    }
                }

                // Ambil dan format Tanggal Lahir (YYYY-MM-DD)
                const hari = String(document.getElementById('tgl_hari').value).padStart(2, '0');
                const bulan = document.getElementById('tgl_bulan').value;
                const tahun = document.getElementById('tgl_tahun').value;
                const tglLahirFormatted = `${tahun}-${bulan}-${hari}`;

                const data = {
                    nik: nikVal,
                    nama: document.getElementById('nama').value.trim(),
                    status: document.getElementById('status').value,
                    tempat_lahir: document.getElementById('tempat_lahir').value.trim(),
                    tanggal_lahir: tglLahirFormatted
                };

                if (index === "-1") {
                    await addDoc(collection(db, "pelanggan"), data);
                } else {
                    const docId = customers[index].id;
                    await updateDoc(doc(db, "pelanggan", docId), data);
                }

                await loadCustomers();
                closeModal('formModal');
                showAlert("Data Pelanggan berhasil disimpan di Cloud!", "Berhasil", "success");
            } catch (error) {
                console.error("Error saving document: ", error);
                showAlert("Terjadi kesalahan saat menyimpan data ke server.", "Gagal", "error");
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

        if (c.tanggal_lahir) {
            const parts = c.tanggal_lahir.split('-');
            if (parts.length === 3) {
                document.getElementById('tgl_tahun').value = parts[0];
                document.getElementById('tgl_bulan').value = parts[1];
                document.getElementById('tgl_hari').value = parts[2];
            }
        }

        document.getElementById('modalTitle').innerText = "Edit Data Pelanggan";
        document.getElementById('formModal').style.display = "flex";
    };

    window.deleteCustomer = (index) => {
        showConfirm("Yakin ingin menghapus data pelanggan ini dari Cloud?", async () => {
            const docId = customers[index].id;
            try {
                await deleteDoc(doc(db, "pelanggan", docId));
                await loadCustomers();
                showAlert("Data pelanggan berhasil dihapus dari Cloud.", "Berhasil", "success");
            } catch (error) {
                console.error("Error deleting document: ", error);
                showAlert("Gagal menghapus data dari server.", "Gagal", "error");
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
            if(document.getElementById('stat-stok3')) document.getElementById('stat-stok3').innerText = invData['3kg'] || 0;
            if(document.getElementById('stat-stok5')) document.getElementById('stat-stok5').innerText = invData['5kg'] || 0;
            if(document.getElementById('stat-stok12')) document.getElementById('stat-stok12').innerText = invData['12kg'] || 0;
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
                if(document.getElementById('stat-stok3')) document.getElementById('stat-stok3').innerText = data['3kg'] || 0;
                if(document.getElementById('stat-stok5')) document.getElementById('stat-stok5').innerText = data['5kg'] || 0;
                if(document.getElementById('stat-stok12')) document.getElementById('stat-stok12').innerText = data['12kg'] || 0;
                
                showAlert("Data inventaris berhasil disimpan di Cloud!", "Berhasil", "success");
            } catch (error) {
                console.error("Error saving inventory: ", error);
                showAlert("Gagal menyimpan inventaris.", "Gagal", "error");
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
                showAlert("Daftar Harga berhasil disimpan di Cloud!", "Berhasil", "success");
            } catch (error) {
                console.error("Error saving prices: ", error);
                showAlert("Gagal menyimpan daftar harga.", "Gagal", "error");
            }
        });
    }

    // =====================================================================
    // 8. LOGIC DROPDOWN PROFIL TOPBAR
    // =====================================================================
    const profileBtn = document.getElementById('profileDropdownBtn');
    const profileMenu = document.getElementById('profileMenu');
    
    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileBtn.classList.toggle('active');
            profileMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                profileBtn.classList.remove('active');
                profileMenu.classList.remove('show');
            }
        });
    }

    const btnMenuLogout = document.getElementById('btnMenuLogout');
    if (btnMenuLogout) {
        btnMenuLogout.addEventListener('click', () => {
            document.getElementById('modalLogout').style.display = "flex";
        });
    }

    // =====================================================================
    // 9. LOGIC DROPDOWN & MANAJEMEN NOTIFIKASI
    // =====================================================================
    const btnNotification = document.getElementById('btnNotification');
    const notifDropdown = document.getElementById('notifDropdown');
    const btnLihatSemua = document.getElementById('btnLihatSemua');
    let semuaDataNotif = [];

    if (btnNotification && notifDropdown) {
        btnNotification.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== btnNotification && !btnNotification.contains(e.target)) {
                notifDropdown.classList.remove('show');
            }
        });
    }

    if (btnLihatSemua) {
        btnLihatSemua.addEventListener('click', (e) => {
            e.preventDefault();
            notifDropdown.classList.remove('show');
            document.getElementById('modalHistori').style.display = "flex";
            renderModalList();
        });
    }

    const btnHistoriProfil = document.getElementById('btnHistoriProfil');
    if (btnHistoriProfil) {
        btnHistoriProfil.addEventListener('click', (e) => {
            e.preventDefault();
            const profileMenu = document.getElementById('profileMenu');
            if(profileMenu) profileMenu.classList.remove('show');
            document.getElementById('modalHistori').style.display = "flex";
            renderModalList(); 
        });
    }

    const filterNotif = document.getElementById('filterNotif');
    if (filterNotif) {
        filterNotif.addEventListener('change', () => renderModalList());
    }

    function renderNotifikasi() {
        const notifBadge = document.getElementById('notifBadge');
        const notifDropdownList = document.getElementById('notifDropdownList');
        let unreadCount = 0;

        notifDropdownList.innerHTML = ""; 

        if (semuaDataNotif.length === 0) {
            notifDropdownList.innerHTML = `
                <div class="notif-empty">
                    <img src="https://cdn-icons-png.flaticon.com/512/7486/7486747.png" alt="Empty" style="width:60px; margin-bottom: 10px; opacity: 0.6;">
                    <div>Belum ada notifikasi</div>
                </div>`;
            if(notifBadge) notifBadge.style.display = "none";
            renderModalList();
            return;
        }

        semuaDataNotif.slice(0, 5).forEach((data) => {
            if (!data.isRead) unreadCount++;
            
            const div = document.createElement("div");
            div.className = `notif-item ${!data.isRead ? 'notif-unread' : ''}`;
            div.innerHTML = `
                <div class="notif-title">${data.judul || 'Info'}</div>
                <div class="notif-desc">${data.pesan || ''}</div>
                <div class="notif-time">${data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : 'Baru saja'}</div>
            `;
            notifDropdownList.appendChild(div);
        });

        const totalUnread = semuaDataNotif.filter(n => !n.isRead).length;
        if (totalUnread > 0 && notifBadge) {
            notifBadge.innerText = totalUnread > 99 ? "99+" : totalUnread;
            notifBadge.style.display = "flex";
        } else if (notifBadge) {
            notifBadge.style.display = "none";
        }

        renderModalList();
    }

    function renderModalList() {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        const selectedFilter = filterNotif ? filterNotif.value : 'all';
        notificationList.innerHTML = "";

        const dataDifilter = semuaDataNotif.filter(data => {
            if (selectedFilter === 'unread') return data.isRead === false;
            if (selectedFilter === 'read') return data.isRead === true;
            return true;
        });

        if (dataDifilter.length === 0) {
            notificationList.innerHTML = `<div class="notif-empty">Tidak ada data notifikasi</div>`;
            return;
        }

        dataDifilter.forEach((data) => {
            const div = document.createElement("div");
            div.className = `notif-item ${!data.isRead ? 'notif-unread' : ''}`;
            div.innerHTML = `
                <div class="notif-title">${data.judul || 'Info'}</div>
                <div class="notif-desc">${data.pesan || ''}</div>
                <div class="notif-time">${data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : 'Baru saja'}</div>
            `;
            notificationList.appendChild(div);
        });
    }

    function listenToNotifications() {
        const notifRef = collection(db, "notifikasi");
        const q = query(notifRef, orderBy("timestamp", "desc"));
        
        onSnapshot(q, (snapshot) => {
            semuaDataNotif = [];
            snapshot.forEach((doc) => {
                semuaDataNotif.push({ id: doc.id, ...doc.data() });
            });
            renderNotifikasi();
        });
    }

    const btnMarkAllRead = document.getElementById('btnMarkAllRead');
    if (btnMarkAllRead) {
        btnMarkAllRead.addEventListener('click', async (e) => {
            e.preventDefault();
            const unreadDocs = semuaDataNotif.filter(d => !d.isRead);
            if(unreadDocs.length === 0) return showAlert("Semua notifikasi sudah dibaca.", "Informasi", "info");

            unreadDocs.forEach(async (docData) => {
                const docRef = doc(db, "notifikasi", docData.id);
                try {
                    await updateDoc(docRef, { isRead: true });
                } catch(error) {
                    console.error("Gagal update notif: ", error);
                }
            });
        });
    }

    // =====================================================================
    // 10. FITUR IMPORT & EXPORT CSV (MENGGUNAKAN MODAL KUSTOM)
    // =====================================================================
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (customers.length === 0) {
                showAlert("Tidak ada data pelanggan untuk di-export.", "Perhatian", "warning");
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,NIK,Nama Lengkap,Status Pemakaian,Tempat Lahir,Tanggal Lahir\n";

            customers.forEach(c => {
                const row = `"${c.nik}","${c.nama}","${c.status}","${c.tempat_lahir}","${c.tanggal_lahir}"`;
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `database_pelanggan_lpg_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // LOGIKA IMPORT CSV
    const importFileInput = document.getElementById('importFile');
    if (importFileInput) {
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = async (event) => {
                const text = event.target.result;
                const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);

                if (rows.length <= 1) {
                    showAlert("Gagal! File CSV kosong atau hanya berisi header.", "Gagal Import", "error");
                    importFileInput.value = '';
                    return;
                }

                let successCount = 0;
                let errorCount = 0;

                for (let i = 1; i < rows.length; i++) {
                    const rowData = rows[i].replace(/"/g, '').split(',');

                    if (rowData.length >= 5) {
                        const nikVal = rowData[0].trim();
                        const namaVal = rowData[1].trim();
                        const statusVal = rowData[2].trim();
                        const tempatLahirVal = rowData[3].trim();
                        const tglLahirVal = rowData[4].trim();

                        if (nikVal.length === 16 && !isNaN(nikVal)) {
                            const qNik = query(collection(db, "pelanggan"), where("nik", "==", nikVal));
                            const querySnap = await getDocs(qNik);

                            if (querySnap.empty) {
                                const data = {
                                    nik: nikVal,
                                    nama: namaVal,
                                    status: statusVal,
                                    tempat_lahir: tempatLahirVal,
                                    tanggal_lahir: tglLahirVal
                                };

                                try {
                                    await addDoc(collection(db, "pelanggan"), data);
                                    successCount++;
                                } catch (err) {
                                    errorCount++;
                                }
                            } else {
                                errorCount++;
                            }
                        } else {
                            errorCount++;
                        }
                    }
                }

                importFileInput.value = '';
                await loadCustomers();

                const msgResult = `Proses Import Selesai.\n\n• Berhasil: ${successCount} data\n• Dilewati / Gagal: ${errorCount} data (NIK duplikat/format tidak sesuai)`;
                showAlert(msgResult, "Hasil Import CSV", successCount > 0 ? "success" : "warning");
            };

            reader.readAsText(file);
        });
    }
});
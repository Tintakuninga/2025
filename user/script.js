import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, addDoc, query, where, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// [FIREBASE CONFIG]
const firebaseConfig = {
    apiKey: "AIzaSyBviMbX_-VMr7RkObmsqN_6Y2skAOdIQkQ",
    authDomain: "logbook-map-43835.firebaseapp.com",
    projectId: "logbook-map-43835",
    storageBucket: "logbook-map-43835.firebasestorage.app",
    messagingSenderId: "278957351659",
    appId: "1:278957351659:web:5005eba610fc14c7c614ae"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- VARIABEL GLOBAL ---
let currentUserUid = null;
let hargaSekarang = { '3kg': 0, '5kg': 0, '12kg': 0 };

const nomorWaAdmin = "6285156109215"; 

document.addEventListener('DOMContentLoaded', () => {

    // Helper: Format Tanggal
    function formatTgl(isoString) {
        if (!isoString) return "-";
        const d = new Date(isoString);
        const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const day = d.getDate();
        const month = bulan[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    // Helper: Format Rupiah
    function formatRupiah(angka) { 
        return new Intl.NumberFormat('id-ID').format(angka);
    }

    // Helper: Tampilkan Modal Alert Custom
    function showCustomAlert(pesan, judul = "Peringatan") {
        document.getElementById('alertTitle').innerText = judul;
        document.getElementById('alertMessage').innerText = pesan;
        document.getElementById('modalAlert').style.display = 'flex';
    }

    // --- AUTENTIKASI ---
    document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (error) { document.getElementById('loginError').innerText = error.message; }
    });
    
    // --- FITUR LOGOUT DENGAN MODAL ---
    // Ubah pemanggilan ID dari btnLogout menjadi btnLogoutItem (yg ada di dropdown menu)
    const btnLogoutItem = document.getElementById('btnLogoutItem');
    const modalLogout = document.getElementById('modalLogout');
    const btnBatalLogout = document.getElementById('btnBatalLogout');
    const btnKonfirmLogout = document.getElementById('btnKonfirmLogout');

    if (btnLogoutItem && modalLogout) {
        btnLogoutItem.addEventListener('click', () => {
            document.getElementById('overflowDropdown').classList.remove('show'); // Tutup menu saat diklik
            modalLogout.style.display = 'flex';
        });
        btnBatalLogout.addEventListener('click', () => modalLogout.style.display = 'none');
        btnKonfirmLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                modalLogout.style.display = 'none';
            }).catch((error) => console.error("Gagal logout:", error));
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('appContent').style.display = "flex";
            document.querySelector('.user-name').innerText = user.displayName;
            loadHarga();
            loadStokInfo();
            loadHistoriPesanan();
        } else {
            currentUserUid = null;
            document.getElementById('loginScreen').style.display = "flex";
            document.getElementById('appContent').style.display = "none";
        }
    });

    // --- FITUR OVERFLOW MENU (TITIK TIGA) ---
    const btnOverflowMenu = document.getElementById('btnOverflowMenu');
    const overflowDropdown = document.getElementById('overflowDropdown');
    
    if (btnOverflowMenu && overflowDropdown) {
        // Toggle menu saat diklik
        btnOverflowMenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Cegah merambat ke document
            overflowDropdown.classList.toggle('show');
        });

        // Tutup menu saat user klik di luar area kotak
        document.addEventListener('click', (e) => {
            if (!overflowDropdown.contains(e.target) && !btnOverflowMenu.contains(e.target)) {
                overflowDropdown.classList.remove('show');
            }
        });
    }

    // --- FITUR GANTI TEMA DARI MENU DROP-DOWN ---
    const themeItem = document.getElementById('themeToggleItem');
    const themeIcon = themeItem ? themeItem.querySelector('i') : null;

    // Cek preferensi tema di penyimpanan perangkat (localStorage)
    const currentTheme = localStorage.getItem('lpg_theme');
    
    // Jika memori kosong (pengguna baru) ATAU memilih 'light', jadikan terang
    if (currentTheme === null || currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) { 
            themeIcon.classList.remove('fa-sun'); 
            themeIcon.classList.add('fa-moon'); 
        }
    } else {
        // Jika pengguna sudah secara eksplisit memilih 'dark'
        document.body.classList.remove('light-theme');
        if (themeIcon) { 
            themeIcon.classList.remove('fa-moon'); 
            themeIcon.classList.add('fa-sun'); 
        }
    }

    if (themeItem) {
        themeItem.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            
            // Simpan pilihan ke memori
            localStorage.setItem('lpg_theme', isLight ? 'light' : 'dark');
            
            // Ubah ikon di menu dropdown
            if (isLight) {
                themeIcon.classList.remove('fa-sun'); 
                themeIcon.classList.add('fa-moon');
            } else {
                themeIcon.classList.remove('fa-moon'); 
                themeIcon.classList.add('fa-sun');
            }
            
            // Tutup dropdown setelah ditekan
            overflowDropdown.classList.remove('show');
        });
    }

    async function loadHistoriPesanan() {
        const listHistori = document.getElementById('listHistori');
        if (!currentUserUid) {
            listHistori.innerHTML = '<p class="text-center text-danger">Silakan login terlebih dahulu.</p>';
            return;
        }

        listHistori.innerHTML = '<p class="text-center text-muted" style="margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat pesanan...</p>';

        try {
            // Ambil data pesanan khusus untuk user yang sedang login
            const q = query(collection(db, "antrean_pesanan"), where("userId", "==", currentUserUid));
            const snapshot = await getDocs(q);
            
            let docsData = [];
            snapshot.forEach(doc => docsData.push({ id: doc.id, ...doc.data() }));
            
            // Urutkan dari yang terbaru (descending)
            docsData.sort((a, b) => {
                const timeA = a.tanggalOrder ? a.tanggalOrder.toMillis() : 0;
                const timeB = b.tanggalOrder ? b.tanggalOrder.toMillis() : 0;
                return timeB - timeA;
            });

            if (docsData.length === 0) {
                listHistori.innerHTML = '<p class="text-center text-muted" style="margin-top: 20px;">Belum ada riwayat pesanan.</p>';
                return;
            }

            listHistori.innerHTML = '';
            docsData.forEach(data => {
                const tglOrder = data.tanggalOrder ? formatTgl(data.tanggalOrder.toDate().toISOString()) : "-";
                const rawDate = data.tanggalOrder ? data.tanggalOrder.toDate().toISOString().split('T')[0] : "";
                
                let status = data.statusPesanan || "Menunggu";

                // 1. Ubah teks status di sini
                let checkStatus = status.toLowerCase();
                if (checkStatus === 'selesai') {
                    status = "Diterima";
                } else if (checkStatus === 'menunggu') {
                    status = "Sedang Diproses";
                } else if (checkStatus === 'tolak' || checkStatus === 'ditolak') {
                    status = "Dibatalkan";
                }

                let statusColor = "var(--text-muted)";
                let statusIcon = "fa-clock";

                const statusLower = status.toLowerCase();
                if (statusLower.includes('terima') || statusLower.includes('selesai') || statusLower.includes('sukses')) {
                    statusColor = "#10b981";
                    statusIcon = "fa-circle-check";
                } else if (statusLower.includes('tolak') || statusLower.includes('batal')) {
                    statusColor = "var(--danger-color)";
                    statusIcon = "fa-circle-xmark";
                } else {
                    statusColor = "var(--blue-color)";
                    statusIcon = "fa-clock-rotate-left";
                }

                const jadwalAmbil = data.jadwalPengambilan ? formatTgl(data.jadwalPengambilan).split(',')[0] : "-";

                listHistori.innerHTML += `
                    <div class="card-panel" data-date="${rawDate}" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid ${statusColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 11px; color: var(--text-muted);">${tglOrder}</span>
                            <span style="font-size: 12px; font-weight: bold; color: ${statusColor};"><i class="fa-solid ${statusIcon}"></i> ${status.toUpperCase()}</span>
                        </div>
                        <h4 style="margin: 0 0 5px 0;">${data.jumlahTabung} Tabung ${data.jenisTabung.toUpperCase()}</h4>
                        <p style="margin: 0; font-size: 13px; color: var(--text-muted);">Jadwal Ambil: <strong>${jadwalAmbil}</strong></p>
                        <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: bold;">Rp ${formatRupiah(data.totalHarga)}</p>
                    </div>
                `;
            });
        } catch (error) {
            console.error("Gagal memuat histori:", error);
            listHistori.innerHTML = '<p class="text-center text-danger" style="margin-top: 20px;">Gagal memuat histori pesanan.</p>';
        }
    }

    // Mengatur tampilan input berdasarkan pilihan dropdown
    function toggleFilterRiwayat() {
        const jenis = document.getElementById('filterJenis').value;
        const uiBulan = document.getElementById('filterBulananUI');
        const uiRentang = document.getElementById('filterRentangUI');
        const btnTerapkan = document.getElementById('btnTerapkanFilter');

        // Reset tampilan
        uiBulan.style.display = 'none';
        uiRentang.style.display = 'none';
        btnTerapkan.style.display = 'block';

        if (jenis === 'semua') {
            btnTerapkan.style.display = 'none';
            terapkanFilterRiwayat(); // Langsung reset tampilkan semua
        } else if (jenis === 'bulanan') {
            uiBulan.style.display = 'flex';
        } else if (jenis === 'rentang') {
            uiRentang.style.display = 'flex';
        }
    }

    // --- FITUR SHARE APLIKASI ---
    const btnShareApp = document.getElementById('btnShareApp');
    if (btnShareApp) {
        btnShareApp.addEventListener('click', async () => {
            const shareData = {
                title: 'Pangkalan LPG Hasmawati',
                text: 'Pesan gas LPG secara online dengan mudah dan cepat tanpa perlu antre di Pangkalan Hasmawati.',
                url: window.location.href // Akan mengambil URL aplikasi saat ini (misal link hosting Anda)
            };
            
            try {
                if (navigator.share) {
                    await navigator.share(shareData); // Fitur native share HP (WhatsApp, dll)
                } else {
                    // Fallback jika dibuka di browser desktop lama
                    navigator.clipboard.writeText(shareData.url);
                    alert("Link aplikasi berhasil disalin ke clipboard!");
                }
            } catch (err) {
                console.error("Gagal melakukan share:", err);
            }
        });
    }

    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const sections = document.querySelectorAll('.page-section');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === target) sec.classList.add('active');
            });

            if (target === 'sec-riwayat') {
                loadHistoriPesanan();
            }
        });
    });

    window.closeModal = (id) => {
        const modal = document.getElementById(id);
        if(modal) modal.style.display = "none";
    };
    
    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^,\d]/g, '');
            this.value = formatRupiah(val);
        });
    });

    // --- 1. LOAD HARGA GAS (REAL-TIME) ---
    function loadHarga() {
        onSnapshot(doc(db, "settings", "harga"), (docSnap) => {
            if (docSnap.exists() && docSnap.data().jual) {
                const jual = docSnap.data().jual.refill;
                
                hargaSekarang['3kg'] = jual['3kg'] || 0;
                hargaSekarang['5kg'] = jual['5kg'] || 0;
                hargaSekarang['12kg'] = jual['12kg'] || 0;
                
                document.getElementById('harga3kg').innerText = "Rp " + formatRupiah(hargaSekarang['3kg']);
                document.getElementById('harga5kg').innerText = "Rp " + formatRupiah(hargaSekarang['5kg']);
                document.getElementById('harga12kg').innerText = "Rp " + formatRupiah(hargaSekarang['12kg']);
                // document.getElementById('priceLastUpdate').innerText = formatTgl(docSnap.data().lastUpdated);
                
                hitungTotalPesanan();
            }
        }, (error) => {
            console.error("Gagal mendengarkan perubahan harga:", error);
        });
    }

    // --- 3. FITUR PEMESANAN GAS & WA ---
    let stokSekarangAdmin = { '3kg': 0, '5kg': 0, '12kg': 0 };

    const orderNama = document.getElementById('orderNama');
    const orderNik = document.getElementById('orderNik');
    const nikError = document.getElementById('nikError');
    const clearNama = document.getElementById('clearNama');
    const clearNik = document.getElementById('clearNik');

    function toggleClearBtn(inputElem, btnElem) {
        if(inputElem && btnElem) {
            btnElem.style.display = inputElem.value.length > 0 ? 'block' : 'none';
        }
    }

    if (orderNama && localStorage.getItem("simpan_nama_user")) {
        orderNama.value = localStorage.getItem("simpan_nama_user");
        toggleClearBtn(orderNama, clearNama);
    }
    if (orderNik && localStorage.getItem("simpan_nik_user")) {
        orderNik.value = localStorage.getItem("simpan_nik_user");
        toggleClearBtn(orderNik, clearNik);
    }

    if (orderNama) {
        orderNama.addEventListener('input', function() {
            localStorage.setItem("simpan_nama_user", this.value);
            toggleClearBtn(orderNama, clearNama);
        });
    }

    if (orderNik) {
        orderNik.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            
            if (this.value.length > 0 && this.value.length !== 16) {
                nikError.style.display = 'block';
                nikError.innerText = "NIK harus persis 16 digit angka.";
                this.style.borderColor = "var(--danger-color)";
            } else {
                nikError.style.display = 'none';
                this.style.borderColor = "var(--border-color)";
            }

            localStorage.setItem("simpan_nik_user", this.value);
            toggleClearBtn(orderNik, clearNik);
        });
    }

    if (clearNama) {
        clearNama.addEventListener('click', () => {
            orderNama.value = '';
            localStorage.removeItem("simpan_nama_user");
            toggleClearBtn(orderNama, clearNama);
            orderNama.focus();
        });
    }

    if (clearNik) {
        clearNik.addEventListener('click', () => {
            orderNik.value = '';
            localStorage.removeItem("simpan_nik_user");
            toggleClearBtn(orderNik, clearNik);
            orderNik.focus();
            
            if(nikError) nikError.style.display = 'none';
            orderNik.style.borderColor = "var(--border-color)";
        });
    }

    // Load Stok dari Admin & Update UI Tombol Plus-Minus serta Halaman Harga
    function loadStokInfo() {
        onSnapshot(doc(db, "settings", "inventaris"), (docSnap) => {
            const elStokHarga3kg = document.getElementById('stokHarga3kg');
            const elStokHarga5kg = document.getElementById('stokHarga5kg');
            const elStokHarga12kg = document.getElementById('stokHarga12kg');
            
            if (docSnap.exists()) {
                const dataInv = docSnap.data();

                // Mengambil waktu pembaruan dari data stok
                const elPriceLastUpdate = document.getElementById('priceLastUpdate');
                if (elPriceLastUpdate && dataInv.lastUpdated) {
                    elPriceLastUpdate.innerText = formatTgl(dataInv.lastUpdated);
                }

                // Simpan stok ke memori lokal
                stokSekarangAdmin['3kg'] = parseInt(dataInv['3kg'] || 0, 10);
                stokSekarangAdmin['5kg'] = parseInt(dataInv['5kg'] || 0, 10);
                stokSekarangAdmin['12kg'] = parseInt(dataInv['12kg'] || 0, 10);
                
                // Fungsi bantuan untuk mengubah teks & warna stok
                const updateTampilanStok = (elemen, jumlahStok) => {
                    if (!elemen) return;
                    if (jumlahStok <= 0) {
                        elemen.classList.remove('text-blue');
                        elemen.classList.add('text-danger');
                        elemen.innerText = "HABIS";
                    } else {
                        elemen.classList.add('text-blue');
                        elemen.classList.remove('text-danger');
                        elemen.innerText = jumlahStok + " TBG";
                    }
                };

                // Update tampilan stok di halaman "Harga"
                updateTampilanStok(elStokHarga3kg, stokSekarangAdmin['3kg']);
                updateTampilanStok(elStokHarga5kg, stokSekarangAdmin['5kg']);
                updateTampilanStok(elStokHarga12kg, stokSekarangAdmin['12kg']);

                updateQtyUI();
            }
        }, (error) => {
            console.error("Gagal mendengarkan data stok:", error);
        });
    }

    // --- LOGIKA TOMBOL PLUS MINUS ---
    const btnMinQty = document.getElementById('btnMinQty');
    const btnAddQty = document.getElementById('btnAddQty');
    const orderJumlah = document.getElementById('orderJumlah');
    const orderJenis = document.getElementById('orderJenis');
    const stokWarning = document.getElementById('stokWarning');
    const btnSubmitPesanan = document.getElementById('btnSubmitPesanan');

    function updateQtyUI() {
        if (!orderJumlah || !orderJenis) return;

        const jenis = orderJenis.value;
        const maxStok = stokSekarangAdmin[jenis] || 0;
        let currentQty = parseInt(orderJumlah.value) || 0;

        if (maxStok <= 0) {
            // Jika Habis: Kunci di 0
            orderJumlah.value = 0;
            btnMinQty.disabled = true;
            btnAddQty.disabled = true;
            btnMinQty.style.opacity = "0.5";
            btnAddQty.style.opacity = "0.5";
            stokWarning.innerText = `Stok ${jenis.toUpperCase()} saat ini HABIS.`;
            stokWarning.style.display = "block";
            btnSubmitPesanan.disabled = true;
            btnSubmitPesanan.style.opacity = "0.5";
        } else {
            // Jika Tersedia: Aktifkan input
            btnSubmitPesanan.disabled = false;
            btnSubmitPesanan.style.opacity = "1";

            if (currentQty === 0) currentQty = 1; // Minimal 1 jika ada stok
            if (currentQty > maxStok) currentQty = maxStok; // Jangan lewat batas stok
            
            orderJumlah.value = currentQty;

            // Kontrol Nyala/Mati tombol Plus Minus
            btnMinQty.disabled = currentQty <= 1;
            btnMinQty.style.opacity = currentQty <= 1 ? "0.5" : "1";
            
            btnAddQty.disabled = currentQty >= maxStok;
            btnAddQty.style.opacity = currentQty >= maxStok ? "0.5" : "1";
            
            if(currentQty >= maxStok) {
                stokWarning.innerText = `Batas maksimal pesanan (${maxStok} Tabung).`;
                stokWarning.style.display = "block";
            } else {
                stokWarning.style.display = "none";
            }
        }
        hitungTotalPesanan();
    }

    // Trigger Perubahan saat Jenis Tabung Dipilih
    if (orderJenis) orderJenis.addEventListener('change', () => {
        const jenis = orderJenis.value;
        const nikGroup = document.getElementById('nikGroup');
        const orderNikInput = document.getElementById('orderNik');

        if (jenis === '3kg') {
            // Tampilkan dan Wajibkan NIK untuk 3kg
            nikGroup.style.display = 'block';
            orderNikInput.required = true;
        } else {
            // Sembunyikan dan Hapus Kewajiban NIK untuk 5.5kg & 12kg
            nikGroup.style.display = 'none';
            orderNikInput.required = false;
            orderNikInput.value = ''; // Kosongkan nilainya
            document.getElementById('nikError').style.display = 'none';
            orderNikInput.style.borderColor = "var(--border-color)";
        }

        orderJumlah.value = 0; // Paksa reset jumlah saat ganti tabung
        updateQtyUI();
    });

    if (btnAddQty) btnAddQty.addEventListener('click', () => {
        const jenis = orderJenis.value;
        const maxStok = stokSekarangAdmin[jenis] || 0;
        let currentQty = parseInt(orderJumlah.value) || 0;
        if (currentQty < maxStok) {
            orderJumlah.value = currentQty + 1;
            updateQtyUI();
        }
    });

    if (btnMinQty) btnMinQty.addEventListener('click', () => {
        let currentQty = parseInt(orderJumlah.value) || 0;
        if (currentQty > 1) {
            orderJumlah.value = currentQty - 1;
            updateQtyUI();
        }
    });

    function hitungTotalPesanan() {
        const elTotal = document.getElementById('orderTotal');
        if(!orderJenis || !orderJumlah || !elTotal) return 0;
        
        const jenis = orderJenis.value;
        const jumlah = parseInt(orderJumlah.value) || 0;
        const total = (hargaSekarang[jenis] || 0) * jumlah;
        
        elTotal.innerText = "Rp " + formatRupiah(total);
        return total;
    }

    // ==========================================
    // FUNGSI VALIDASI ATURAN PEMBELIAN 3KG
    // ==========================================
    async function validasiAturan3kg(nik, kategori, jumlahPesananBaru) {
        if (!nik || nik.length !== 16) return { valid: false, pesan: "NIK tidak valid!" };

        const skrg = new Date();
        const awalBulan = new Date(skrg.getFullYear(), skrg.getMonth(), 1); 

        let totalBulanIni = 0;
        let waktuTransaksiTerakhir = null;
        
        let isPelangganTetap = false;

        try {
            const qPelanggan = query(collection(db, "pelanggan"), where("nik", "==", nik));
            const snapPelanggan = await getDocs(qPelanggan);
            
            if (!snapPelanggan.empty) {
                isPelangganTetap = true;
            }

            if (isPelangganTetap) {
                return { valid: true }; 
            }

            const q = query(
                collection(db, "antrean_pesanan"), 
                where("nikKtp", "==", nik),
                where("jenisTabung", "==", "3kg"),
                where("tanggalOrder", ">=", awalBulan)
            );
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                totalBulanIni += parseInt(data.jumlahTabung || 0);
                
                if (data.tanggalOrder) {
                    const tglPesan = data.tanggalOrder.toDate(); 
                    if (!waktuTransaksiTerakhir || tglPesan > waktuTransaksiTerakhir) {
                        waktuTransaksiTerakhir = tglPesan;
                    }
                }
            });

            if (kategori === "Usaha Mikro") {
                if (totalBulanIni + jumlahPesananBaru > 10) {
                    return { valid: false, pesan: `Batas Usaha Mikro 10 tabung/bulan. NIK ini sudah membeli ${totalBulanIni} tabung.` };
                }
                return { valid: true };
            }

            if (kategori === "Rumah Tangga") {
                if (jumlahPesananBaru > 2) {
                    return { valid: false, pesan: "Rumah Tangga maksimal 2 tabung per pesanan." };
                }
                if (totalBulanIni + jumlahPesananBaru > 5) {
                    return { valid: false, pesan: `Batas Rumah Tangga 5 tabung/bulan. NIK ini sudah membeli ${totalBulanIni} tabung.` };
                }
                
                if (waktuTransaksiTerakhir) {
                    const hariIni = new Date(skrg.getFullYear(), skrg.getMonth(), skrg.getDate());
                    const hariTerakhir = new Date(
                        waktuTransaksiTerakhir.getFullYear(), 
                        waktuTransaksiTerakhir.getMonth(), 
                        waktuTransaksiTerakhir.getDate()
                    );

                    const selisihMilidetik = hariIni.getTime() - hariTerakhir.getTime();
                    const selisihHari = selisihMilidetik / (1000 * 3600 * 24);
                    
                    if (selisihHari < 1) {
                        return { valid: false, pesan: "Harap tunggu 1 hari setelah pembelian terakhir untuk memesan kembali." };
                    }
                }
                return { valid: true };
            }

        } catch (error) {
            console.error("Error cek validasi:", error);
            return { valid: false, pesan: "Terjadi kesalahan saat memeriksa batas pembelian. Coba lagi nanti." };
        }
    }

        // PENGATURAN KALENDER
        const inputTanggal = document.getElementById('orderTanggal');
        if (inputTanggal) {

            const hariIni = new Date();
            const yyyy = hariIni.getFullYear();
            const mm = String(hariIni.getMonth() + 1).padStart(2, '0'); 
            const dd = String(hariIni.getDate()).padStart(2, '0');
            const formatHariIni = `${yyyy}-${mm}-${dd}`;
            
            inputTanggal.min = formatHariIni;

            /* ========================================================
            2. VALIDASI HARI DIMATIKAN SEMENTARA
            (Agar pelanggan bisa memilih hari Senin sampai Minggu)
            ======================================================== */
            /*
            inputTanggal.addEventListener('change', function() {
                const tanggalDipilih = new Date(this.value);
                const hariKe = tanggalDipilih.getDay();

                // Jika bukan hari Senin (1), Rabu (3), atau Jumat (5)
                if (hariKe !== 1 && hariKe !== 3 && hariKe !== 5) {
                    showCustomAlert("Mohon maaf, jadwal masuk gas pangkalan kami hanya tersedia di hari:\n\n📅 Senin, Rabu, dan Jumat.", "Hari Tidak Tersedia");
                    this.value = '';
                }
            });
            */
        }

    // --- PROSES SUBMIT PESANAN ---
    const formPesanan = document.getElementById('formPesanan');
    if(formPesanan) {
        formPesanan.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = document.getElementById('btnSubmitPesanan');
            const nama = document.getElementById('orderNama').value.trim();
            const nik = document.getElementById('orderNik').value.trim();
            const kategori = document.getElementById('orderKategori') ? document.getElementById('orderKategori').value : "-";
            const jenis = document.getElementById('orderJenis').value;
            const jumlah = parseInt(document.getElementById('orderJumlah').value) || 0;
            const totalHarga = hitungTotalPesanan();
            const jadwalAmbil = document.getElementById('orderTanggal').value;

            let finalNik = nik;
            
            // 1. Validasi Keamanan NIK KTP dan Aturan 3KG
            if (jenis === '3kg') {
                if (nik.length !== 16) {
                    showCustomAlert("NIK KTP harus persis 16 digit angka untuk gas 3 kg.", "Format NIK Salah");
                    return;
                }
                
                const dd = parseInt(nik.substring(6, 8), 10);
                const mm = parseInt(nik.substring(8, 10), 10);
                if (mm < 1 || mm > 12) {
                    showCustomAlert("NIK tidak sesuai standar.\n(Silakan periksa kembali NIK Anda).", "Format NIK Salah");
                    return;
                }
                const isValidHari = (dd >= 1 && dd <= 31) || (dd >= 41 && dd <= 71);
                if (!isValidHari) {
                    showCustomAlert("NIK tidak sesuai standar.\n(Silakan periksa kembali NIK Anda).", "Format NIK Salah");
                    return;
                }

                // --- JALANKAN VALIDASI ATURAN PEMERINTAH ---
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa Batas NIK...`;
                
                const hasilValidasi = await validasiAturan3kg(nik, kategori, jumlah);
                
                if (!hasilValidasi.valid) {
                    // Gunakan modal custom untuk penolakan
                    showCustomAlert(hasilValidasi.pesan, "PESANAN DITOLAK");
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Pesan & Lanjut ke WA`;
                    return; 
                }
            } else {
                finalNik = "-";
            }

            // 2. Validasi Stok
            if (jumlah <= 0 || jumlah > (stokSekarangAdmin[jenis] || 0)) {
                showCustomAlert("Jumlah pesanan tidak valid atau stok telah habis.", "Pesanan Ditolak");
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Pesan & Lanjut ke WA`;
                return;
            }

            // 3. Proses Simpan ke Database
            try {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...`;

                await addDoc(collection(db, "antrean_pesanan"), {
                    userId: currentUserUid,
                    namaLengkap: nama,
                    nikKtp: finalNik,
                    kategoriPembeli: jenis === '3kg' ? kategori : "-",
                    jenisTabung: jenis,
                    jumlahTabung: jumlah,
                    totalHarga: totalHarga,
                    jadwalPengambilan: jadwalAmbil,
                    statusPesanan: "Menunggu",
                    tanggalOrder: serverTimestamp() 
                });

                await addDoc(collection(db, "notifikasi"), {
                    judul: "Pesanan Masuk (Antrean)",
                    pesan: `Pesanan baru: ${jumlah} tabung ${jenis} dari ${nama}`,
                    isRead: false,
                    timestamp: serverTimestamp()
                });

                orderJumlah.value = 1;
                updateQtyUI();

                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Pesan & Lanjut ke WA`;

                const jenisLabel = jenis === '3kg' ? '3 kg' : jenis === '5kg' ? '5.5 kg' : '12 kg';
                const infoKat = jenis === '3kg' ? `\n*Kategori:* ${kategori}` : "";
                const formatJadwal = jadwalAmbil ? formatTgl(jadwalAmbil).split(',')[0] : "-";
                
                const pesanWa = `Halo Admin Pangkalan, saya ingin memesan gas:\n\n*Nama:* ${nama}\n*NIK:* ${finalNik}${infoKat}\n*Jadwal Ambil:* ${jadwalAmbil}\n*Pesanan:* ${jumlah} Tabung Refill ${jenisLabel}\n*Total Bayar:* Rp ${formatRupiah(totalHarga)}\n\nMohon konfirmasi pesanan saya. Terima kasih.`;
                const waUrl = `https://wa.me/${nomorWaAdmin}?text=${encodeURIComponent(pesanWa)}`;
                
                window.location.href = waUrl; 

            } catch (error) {
                console.error("Gagal membuat pesanan:", error);
                showCustomAlert("Terjadi kesalahan sistem saat memproses pesanan Anda. Silakan coba lagi.", "Terjadi Kesalahan");
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Pesan & Lanjut ke WA`;
            }
        });
    }

    // ==========================================
    // FITUR PWA (SERVICE WORKER, INSTALL & UPDATE)
    // ==========================================

    let deferredPrompt;
    const installBtn = document.getElementById('pwaInstallBtn');
    const updateBanner = document.getElementById('pwaUpdateBanner');
    const updateBtn = document.getElementById('pwaUpdateBtn');
    const pwaWrapper = document.getElementById('pwaInstallWrapper');
    const closeBtn = document.getElementById('pwaCloseBtn');

    // 1. Logika Tombol Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        if(pwaWrapper) pwaWrapper.style.display = 'flex';
    });

    // 2. Fungsi saat tombol "Install App" diklik
    if(installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User menginstal aplikasi');
                    if(pwaWrapper) pwaWrapper.style.display = 'none';
                }
                deferredPrompt = null;
            }
        });
    }

    // 3. Fungsi TAMBAHAN saat tombol "X" diklik
    if(closeBtn) {
        closeBtn.addEventListener('click', () => {
            if(pwaWrapper) {
                pwaWrapper.style.opacity = '0';
                pwaWrapper.style.transform = 'translateY(-50%) scale(0.9)';
                
                setTimeout(() => {
                    pwaWrapper.style.display = 'none';
                }, 300);
            }
        });
    }

    // 4. Fitur Geser Tombol Install PWA
    const dragElement = document.querySelector('.pwa-install-wrapper');

    if (dragElement) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        // Deteksi sentuhan (HP) dan klik mouse (PC)
        dragElement.addEventListener("touchstart", dragStart, { passive: false });
        dragElement.addEventListener("mousedown", dragStart);

        function dragStart(e) {
            // Abaikan drag jika yang ditekan adalah tombol X (Close)
            if (e.target.closest('.pwa-close-btn')) return; 

            e = e || window.event;
            if (e.type === 'touchstart') {
                pos3 = e.touches[0].clientX;
                pos4 = e.touches[0].clientY;
            } else {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
            }

            document.addEventListener("touchend", dragEnd);
            document.addEventListener("touchmove", dragAction, { passive: false });
            document.addEventListener("mouseup", dragEnd);
            document.addEventListener("mousemove", dragAction);
        }

        function dragAction(e) {
            e = e || window.event;
            e.preventDefault(); // Cegah scroll layar

            let clientX, clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;

            // Reset transform awal agar posisi tidak melompat saat pertama digeser
            if (dragElement.style.transform !== "none") {
                let rect = dragElement.getBoundingClientRect();
                dragElement.style.transform = "none";
                dragElement.style.left = rect.left + "px";
                dragElement.style.top = rect.top + "px";
                dragElement.style.bottom = "auto";
                dragElement.style.right = "auto";
            }

            // Terapkan posisi baru
            dragElement.style.top = (dragElement.offsetTop - pos2) + "px";
            dragElement.style.left = (dragElement.offsetLeft - pos1) + "px";
        }

        function dragEnd() {
            document.removeEventListener("touchend", dragEnd);
            document.removeEventListener("touchmove", dragAction);
            document.removeEventListener("mouseup", dragEnd);
            document.removeEventListener("mousemove", dragAction);
        }
    }

    // 5. Registrasi Service Worker & Deteksi Update
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((registration) => {
                console.log('Service Worker Terdaftar:', registration);

                // Deteksi jika ada update Service Worker (Versi baru)
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        // Jika ada pekerja (worker) baru yang menunggu, berarti ada update
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if(updateBanner) updateBanner.style.display = 'flex';
                            
                            // Jika tombol update ditekan
                            if (updateBtn) {
                                updateBtn.onclick = () => {
                                    updateBanner.style.display = 'none'; 
                                    updateBtn.innerHTML = "Memperbarui...";
                                    
                                    newWorker.postMessage({ action: 'skipWaiting' });
                                };
                            }
                        }
                    });
                });
            }).catch((err) => {
                console.log('Gagal mendaftarkan Service Worker:', err);
            });
        });

        // Refresh halaman secara otomatis saat versi baru berhasil diaktifkan
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }

    // ==========================================
    // FITUR FILTER RIWAYAT PESANAN
    // ==========================================

    // 1. Fungsi untuk mengatur tampilan form filter saat dropdown dipilih
    window.toggleFilterRiwayat = function() {
        const jenis = document.getElementById('filterJenis').value;
        const uiBulan = document.getElementById('filterBulananUI');
        const uiRentang = document.getElementById('filterRentangUI');
        const btnTerapkan = document.getElementById('btnTerapkanFilter');

        // Reset UI: Sembunyikan semuanya dulu
        uiBulan.style.display = 'none';
        uiRentang.style.display = 'none';
        btnTerapkan.style.display = 'block';

        if (jenis === 'semua') {
            btnTerapkan.style.display = 'none'; // Sembunyikan tombol
            window.terapkanFilterRiwayat();     // Langsung eksekusi untuk reset tampilan
        } 
        else if (jenis === 'bulanan') {
            uiBulan.style.display = 'flex';     // Munculkan input bulan
        } 
        else if (jenis === 'rentang') {
            uiRentang.style.display = 'flex';   // Munculkan input rentang tanggal
        }
    };

    // 2. Fungsi utama untuk mengeksekusi logika filter
    window.terapkanFilterRiwayat = function() {
        const jenis = document.getElementById('filterJenis').value;
        const listKartu = document.querySelectorAll('#listHistori .card-panel');

        // Ambil nilai dari input pengguna
        const filterBulan = document.getElementById('inputFilterBulan').value; // Hasil: YYYY-MM
        const startDate = document.getElementById('inputStartDate').value;     // Hasil: YYYY-MM-DD
        const endDate = document.getElementById('inputEndDate').value;         // Hasil: YYYY-MM-DD

        listKartu.forEach(kartu => {
            const tanggalKartu = kartu.getAttribute('data-date'); // Hasil: YYYY-MM-DD
            if (!tanggalKartu) return; // Lewati jika kartu tidak punya atribut tanggal

            let tampilkan = true; // Status default: tampilkan

            if (jenis === 'semua') {
                tampilkan = true;
            } 
            else if (jenis === 'bulanan') {
                // Jika user sudah memilih bulan, cek apakah tanggal kartu diawali dengan bulan tsb
                if (filterBulan) {
                    tampilkan = tanggalKartu.startsWith(filterBulan);
                }
            } 
            else if (jenis === 'rentang') {
                // Jika tanggal kartu kurang dari tanggal mulai, maka sembunyikan
                if (startDate && tanggalKartu < startDate) {
                    tampilkan = false;
                }
                // Jika tanggal kartu lebih dari tanggal akhir, maka sembunyikan
                if (endDate && tanggalKartu > endDate) {
                    tampilkan = false;
                }
            }

            // Terapkan status visibilitas pada kartu (muncul/hilang)
            kartu.style.display = tampilkan ? 'block' : 'none';
        });
    };
}); // End DOMContentLoaded
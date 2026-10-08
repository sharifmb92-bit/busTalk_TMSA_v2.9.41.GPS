// medbasha - Lógica de BusTalk_v 2.9.41_GPS_INTELIGENTE
const firebaseConfig = {
    apiKey: "AIzaSyC7b6_T0ze2HgXiYHfvUeL12JSXE7ZKogc",
    authDomain: "misturnos-fe3ea.firebaseapp.com",
    databaseURL: "https://misturnos-fe3ea-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "misturnos-fe3ea",
    storageBucket: "misturnos-fe3ea.firebasestorage.app",
    messagingSenderId: "1029095925443",
    appId: "1:1029095925443:web:873240d85ac5160f392476"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// INDEXED DB HELPER (medbasha)
const idb = {
    db: null,
    async init() {
        if(this.db) return this.db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("BusTalkDB", 3);
            req.onupgradeneeded = e => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
            };
            req.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
            req.onerror = e => reject(e.target.error);
        });
    },
    async get(key) {
        const db = await this.init();
        return new Promise(resolve => {
            const tx = db.transaction("settings", "readonly");
            const req = tx.objectStore("settings").get(key);
            req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null);
        });
    },
    async set(key, val) {
        const db = await this.init();
        return new Promise(resolve => {
            const tx = db.transaction("settings", "readwrite");
            tx.objectStore("settings").put(val, key);
            tx.oncomplete = () => resolve();
        });
    },
    async remove(key) {
        const db = await this.init();
        return new Promise(resolve => {
            const tx = db.transaction("settings", "readwrite");
            tx.objectStore("settings").delete(key);
            tx.oncomplete = () => resolve();
        });
    }
};

function busTalkApp() {
    return {
        sesionIniciada: false, conectado: false, wakeLockStatus: null,
        necesitaPin: false, inputPin: '', errorPin: false,
        mostrarTutorialModal: false,
        miBusInput: '', miLineaInput: '', 
        miBus: '', miLinea: '', miPax: 0, miUbicacion: '',
        enParada: true, minutosRuta: 15, minutosRestantes: 15, etaFinal: null, miAlerta: null,
        miTramoActual: '', esSentidoIda: true,
        segundosEnParadaActual: 0, inicioParadaTimestamp: Date.now(),
        acumuladoParadasTrayecto: 0, ultimoTiempoParadoCongelado: 0, acumuladoRetrasoTráfico: 0,
        compañeros:[], misParadasArray:[],
        mostrarModalZonas: false, mostrarModalResumen: false, esTerminalGaldana: false, esTerminalTomas: false,
        abrirPoniente: false, abrirLevante: false,
        modoColor: 'noche', mostrarAvisoApagarRadio: false, avisoDescartadoManualEstado: false, mostrarAvisoFinalRuta: false,
        
        ultimaActividadTimestamp: Date.now(),
        intervaloWatchdogInactividad: null,

        modoAutoGPS: true, gpsActivo: false, coordsTexto: '',
        
        // VARIABLES DE DIAGNÓSTICO Y CONTROL GPS (medbasha)
        gpsDiagNombre: 'Sin destino (0%)',
        gpsDiagDistancia: 0,
        gpsDiagVelocidad: 0,
        contadorEvaluacionesCerca: 0,

        // COORDENADAS EXACTAS DE MARQUESINAS SEGÚN SENTIDO RECALIBRADAS (medbasha)
        coordenadasParadasIda: {
            "Maó": { lat: 39.886850, lng: 4.258900 },               // Dársena Estació de Maó (Esplanada)
            "Argen": { lat: 39.898850, lng: 4.201020 },             // L'Argentina
            "Alaior P.": { lat: 39.932480, lng: 4.144180 },         // Alaior Polígon
            "Alaior C.": { lat: 39.934810, lng: 4.140830 },         // Alaior Av. Pare Camps
            "Mer": { lat: 39.980240, lng: 4.089510 },               // Es Mercadal Rotonda
            "Ferr": { lat: 39.982300, lng: 3.984150 },              // Dársena Ferreries Av. Jaume Mascaró
            "Ciu": { lat: 39.998190, lng: 3.839130 },               // Ciutadella Plaça de la Pau
            "Plaça de la Pau": { lat: 39.998190, lng: 3.839130 }
        },

        coordenadasParadasVuelta: {
            "Ciu": { lat: 39.998190, lng: 3.839130 },               // Ciutadella Plaça de la Pau
            "Plaça de la Pau": { lat: 39.998190, lng: 3.839130 },
            "Ferr": { lat: 39.982300, lng: 3.984150 },              // Dársena Ferreries Av. Jaume Mascaró
            "Mer": { lat: 39.980120, lng: 4.089800 },               // Es Mercadal
            "Alaior C.": { lat: 39.934920, lng: 4.140950 },         // Alaior Centro
            "Alaior P.": { lat: 39.932350, lng: 4.144320 },         // Alaior Polígon
            "Argen": { lat: 39.898700, lng: 4.201200 },             // L'Argentina
            "Maó": { lat: 39.886850, lng: 4.258900 }                // Dársena Estació de Maó
        },

        // COORDENADAS GENERALES RECALIBRADAS MARQUESINAS DE ISLA (medbasha)
        coordenadasParadasGeneral: {
            "Fontanilles": { lat: 39.884028, lng: 4.275000 },
            "Castell": { lat: 39.878500, lng: 4.290500 },           // Es Castell C/ Gran
            "H. Mateu Orfila": { lat: 39.883056, lng: 4.258056 },
            "S. Lluís": { lat: 39.851200, lng: 4.258200 },          // Sant Lluís Av. de sa Pau
            "S. Climent": { lat: 39.869000, lng: 4.217500 },        // Sant Climent C/ Sant Jaume
            "Canutells": { lat: 39.851800, lng: 4.168500 },
            "C. Porter": { lat: 39.871200, lng: 4.131500 },         // Cala en Porter Av. Central
            "S'Algar": { lat: 39.832200, lng: 4.295000 },
            "Alcaufar": { lat: 39.828500, lng: 4.291000 },
            "P. Prima": { lat: 39.814500, lng: 4.280200 },          // Punta Prima
            "Binibèquer": { lat: 39.821000, lng: 4.238000 },
            "S. Tomàs 1ª": { lat: 39.912300, lng: 4.038500 },        // Sant Tomàs Parada 1
            "S. Tomàs 2ª": { lat: 39.914100, lng: 4.041500 },
            "S. Tomàs 3ª": { lat: 39.916000, lng: 4.045000 },
            "Galdana": { lat: 39.936200, lng: 3.962800 },           // Cala Galdana Rotonda
            "Cementerio": { lat: 39.975000, lng: 3.978000 },
            "Camping": { lat: 39.962000, lng: 3.971000 },
            "C. Mitjana": { lat: 39.948000, lng: 3.965000 },
            "Migjorn": { lat: 39.948100, lng: 4.081200 },           // Es Migjorn Gran
            "Son Bou": { lat: 39.898800, lng: 4.072500 }            // Son Bou Passeig Marítim
        },

        estadoRadio: 'reposo', elQueHabla: null, lineaQueHabla: '',
        mediaRecorder: null, chunks:[], streamingMsgId: null, ultimoAudio: null,
        relojUI: null, modoGlobal: false, intervaloPax: null, watchdogRadio: null,
        unsubBuses: null, unsubRadio: null, intervalRelojRuta: null,
        streamActivo: null, temporizadorSeguridadMic: null,
        
        ultimoAvisoParadaSegs: 0,

        async init() {
            if (navigator.storage && navigator.storage.persist) {
                await navigator.storage.persist();
            }

            const tutorialVisto = await idb.get('bustalk_tutorial_v2937');
            if (!tutorialVisto) {
                this.mostrarTutorialModal = true;
            }

            const pinValidado = await idb.get('bustalk_pin_v298');
            if (pinValidado !== '33000') {
                this.necesitaPin = true;
            }

            const busGuardado = await idb.get('bustalk_bus');
            const lineaGuardada = await idb.get('bustalk_linea');
            const modoGuardado = await idb.get('bustalk_modo_color_v2');
            
            if (busGuardado) {
                this.miBusInput = busGuardado;
                this.procesarInputBus();
            }
            if (lineaGuardada) {
                this.miLineaInput = lineaGuardada;
                this.miLinea = lineaGuardada;
            }
            if (modoGuardado) this.modoColor = modoGuardado;
            
            this.relojUI = setInterval(() => { this.compañeros = [...this.compañeros]; }, 1000);
            
            this.intervalRelojRuta = setInterval(() => {
                if (!this.enParada && this.etaFinal && this.miAlerta !== 'RETENCIÓN') {
                    let antes = this.minutosRestantes;
                    this.minutosRestantes = Math.ceil((this.etaFinal - Date.now()) / 60000);
                    
                    if (antes > 0 && this.minutosRestantes <= 0) {
                        this.playAudioAviso('llegada');
                    }
                }
            }, 1000);

            this.intervaloWatchdogInactividad = setInterval(() => {
                if (this.sesionIniciada) {
                    const tiempoInactivo = Date.now() - this.ultimaActividadTimestamp;
                    if (tiempoInactivo >= (60 * 60 * 1000)) {
                        this.autoApagarPorInactividad();
                    }
                }
            }, 30000);

            setInterval(() => {
                if (this.enParada && this.sesionIniciada) {
                    this.segundosEnParadaActual = Math.floor((Date.now() - this.inicioParadaTimestamp) / 1000);
                    
                    let idx = this.misParadasArray.indexOf(this.miUbicacion);
                    let esExtremo = (idx === 0 || idx === this.misParadasArray.length - 1);

                    if (esExtremo) {
                        if (this.segundosEnParadaActual >= 180 && !this.mostrarAvisoApagarRadio && !this.avisoDescartadoManualEstado && !this.mostrarAvisoFinalRuta) {
                            this.mostrarAvisoApagarRadio = true;
                            this.playAudioAviso('cierre_mic');
                        }
                    } else {
                        this.mostrarAvisoApagarRadio = false;
                        
                        if (this.segundosEnParadaActual >= 150 && this.ultimoAvisoParadaSegs < 150) {
                            this.playAudioAviso('aviso_parada_suave');
                            this.ultimoAvisoParadaSegs = 150;
                        } 
                        else if (this.segundosEnParadaActual >= 240 && (this.segundosEnParadaActual - 150) % 90 === 0 && this.segundosEnParadaActual > this.ultimoAvisoParadaSegs) {
                            this.playAudioAviso('aviso_parada_fuerte');
                            this.ultimoAvisoParadaSegs = this.segundosEnParadaActual;
                        }
                    }
                } else {
                    this.mostrarAvisoApagarRadio = false;
                }
            }, 1000);

            window.addEventListener('pagehide', () => {
                if (this.sesionIniciada && this.conectado) {
                    this.limpiarSesionEnBD();
                }
            });

            this.iniciarGPSGeofencing();
        },

        async entendidoTutorial() {
            this.registrarActividad();
            await idb.set('bustalk_tutorial_v2937', 'visto');
            this.mostrarTutorialModal = false;
            if ("vibrate" in navigator) navigator.vibrate(50);
        },

        abrirTutorialManual() {
            this.registrarActividad();
            this.mostrarTutorialModal = true;
            if ("vibrate" in navigator) navigator.vibrate(30);
        },

        obtenerCodigoLineaActual() {
            if (!this.miLinea) return this.miBus || 'BUS';
            let match = this.miLinea.match(/^(L\d+[ab]?)/i);
            if (match) return match[1].toUpperCase();
            return this.miBus || 'BUS';
        },

        descartarAvisoManual() {
            this.registrarActividad();
            this.mostrarAvisoApagarRadio = false;
            this.avisoDescartadoManualEstado = true;
        },

        registrarActividad() {
            this.ultimaActividadTimestamp = Date.now();
        },

        autoApagarPorInactividad() {
            if (this.unsubBuses) this.unsubBuses();
            if (this.unsubRadio) this.unsubRadio();
            this.limpiarSesionEnBD();
            idb.remove('bustalk_bus');
            idb.remove('bustalk_linea');
            location.reload();
        },

        async verificarPin() {
            this.registrarActividad();
            if (this.inputPin.trim() === '33000') {
                await idb.set('bustalk_pin_v298', '33000');
                this.necesitaPin = false;
                this.errorPin = false;
                if ("vibrate" in navigator) navigator.vibrate([50, 50, 50]);
            } else {
                this.errorPin = true;
                this.inputPin = '';
                if ("vibrate" in navigator) navigator.vibrate([100, 100, 100]);
            }
        },

        obtenerParadasTriptico() {
            if (this.misParadasArray.length <= 3) return this.misParadasArray;
            let idx = this.misParadasArray.indexOf(this.miUbicacion);
            if (idx === -1) idx = 0;
            
            if (idx === 0) return this.misParadasArray.slice(0, 3);
            if (idx === this.misParadasArray.length - 1) return this.misParadasArray.slice(-3);
            
            return this.misParadasArray.slice(idx - 1, idx + 2);
        },

        toggleModoGPS() {
            this.registrarActividad();
            this.modoAutoGPS = !this.modoAutoGPS;
            if ("vibrate" in navigator) navigator.vibrate(50);
        },

        obtenerCoordenadasDestino(nombreParada) {
            if (!nombreParada) return null;
            let nombreLimpio = nombreParada.trim();

            if (nombreLimpio.startsWith("Ferr")) nombreLimpio = "Ferr";
            if (nombreLimpio.startsWith("Alaior")) nombreLimpio = nombreLimpio.includes("C") ? "Alaior C." : "Alaior P.";

            if (this.esSentidoIda && this.coordenadasParadasIda[nombreLimpio]) {
                return this.coordenadasParadasIda[nombreLimpio];
            } else if (!this.esSentidoIda && this.coordenadasParadasVuelta[nombreLimpio]) {
                return this.coordenadasParadasVuelta[nombreLimpio];
            }
            return this.coordenadasParadasGeneral[nombreLimpio] || null;
        },

        iniciarGPSGeofencing() {
            if ("geolocation" in navigator) {
                navigator.geolocation.watchPosition(
                    (pos) => {
                        this.gpsActivo = true;
                        let lat = pos.coords.latitude;
                        let lng = pos.coords.longitude;
                        let vel = (pos.coords.speed !== null && pos.coords.speed !== undefined) 
                                  ? Math.round(pos.coords.speed * 3.6) : 0;
                        
                        this.gpsDiagVelocidad = vel;

                        if (this.modoAutoGPS && this.sesionIniciada) {
                            this.procesarUbicacionRobustaGPS(lat, lng, vel);
                        }
                    },
                    (err) => { this.gpsActivo = false; },
                    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
                );
            }
        },

        // PROCESADOR ROBUSTO MULTIPARADA (medbasha - v2.9.41)
        procesarUbicacionRobustaGPS(lat, lng, velKmh) {
            // 1. EVALUAR AUTO-SALIDA SI ESTAMOS "EN PARADA"
            if (this.enParada) {
                const coordsActuales = this.obtenerCoordenadasDestino(this.miUbicacion);
                if (coordsActuales) {
                    const distActual = Math.round(this.calcularDistanciaMetros(lat, lng, coordsActuales.lat, coordsActuales.lng));
                    this.gpsDiagDistancia = distActual;
                    this.gpsDiagNombre = `${this.miUbicacion} (100%)`;

                    // REQUISITO DOBLE: Alejarse >150m Y velocidad >15 km/h
                    if (distActual > 150 && velKmh > 15) {
                        this.toggleParada(); // Conmuta automáticamente a "En Ruta"
                    }
                }
                return;
            }

            // 2. ESCANEAR TODAS LAS PARADAS RESTANTES SI ESTAMOS "EN RUTA"
            let idxActual = this.misParadasArray.indexOf(this.miUbicacion);
            if (idxActual === -1) idxActual = 0;

            let paradaDetectada = null;
            let menorDistancia = 999999;

            // Escanea desde la siguiente parada hasta el final de la ruta
            for (let i = idxActual + 1; i < this.misParadasArray.length; i++) {
                let nombreParada = this.misParadasArray[i];
                let coords = this.obtenerCoordenadasDestino(nombreParada);
                if (coords) {
                    let dist = this.calcularDistanciaMetros(lat, lng, coords.lat, coords.lng);
                    if (dist <= 150 && dist < menorDistancia) {
                        menorDistancia = dist;
                        paradaDetectada = nombreParada;
                    }
                }
            }

            // 3. CONFIRMAR LLEGADA A LA PARADA DETECTADA
            if (paradaDetectada) {
                this.contadorEvaluacionesCerca++;
                this.gpsDiagDistancia = Math.round(menorDistancia);
                
                let porcentaje = Math.min(99, 60 + (this.contadorEvaluacionesCerca * 20));
                this.gpsDiagNombre = `${paradaDetectada} (${porcentaje}%)`;

                // Al permanecer 2 evaluaciones consecutivas dentro del radio de 150m -> LLEGADA CONFIRMADA
                if (this.contadorEvaluacionesCerca >= 2) {
                    this.contadorEvaluacionesCerca = 0;
                    this.gpsDiagNombre = `${paradaDetectada} (100%)`;
                    this.actualizarUbicacion(paradaDetectada); // Asigna enParada = true y cambia ubicación
                }
            } else {
                this.contadorEvaluacionesCerca = 0;
                let siguienteDestino = this.obtenerDestinoSiguiente();
                if (siguienteDestino) {
                    let coordsSiguiente = this.obtenerCoordenadasDestino(siguienteDestino);
                    if (coordsSiguiente) {
                        this.gpsDiagDistancia = Math.round(this.calcularDistanciaMetros(lat, lng, coordsSiguiente.lat, coordsSiguiente.lng));
                    }
                    this.gpsDiagNombre = `${siguienteDestino} (0%)`;
                } else {
                    this.gpsDiagNombre = 'Sin destino (0%)';
                    this.gpsDiagDistancia = 0;
                }
            }
        },

        calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
            const R = 6371e3;
            const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        },

        procesarInputBus() {
            this.registrarActividad();
            let txt = this.miBusInput.trim().toUpperCase();
            if (!txt) return;

            const mapaServicios = {
                "L01A": "L01a (Maó ➔ Ciu)", "L01B": "L01b (Ciu ➔ Maó)",
                "L14A": "L14a Exprés (Maó ➔ Ciu)", "L14B": "L14b Exprés (Ciu ➔ Maó)",
                "L02A": "L02a (Maó ➔ Castell)", "L02B": "L02b (Castell ➔ Maó)",
                "L03A": "L03a (Maó ➔ S. Lluís)", "L03B": "L03b (S. Lluís ➔ Maó)",
                "L21A": "L21a (Maó ➔ S. Climent)", "L21B": "L21b (S. Climent ➔ Maó)",
                "L22A": "L22a (Maó ➔ Canutells)", "L22B": "L22b (Canutells ➔ Maó)",
                "L31A": "L31a (Maó ➔ C. Porter)", "L31B": "L31b (C. Porter ➔ Maó)",
                "L08A": "L08a (Maó ➔ C. Porter)", "L08B": "L08b (C. Porter ➔ Maó)",
                "L91A": "L91a (Maó ➔ S'Algar)", "L91B": "L91b (Alcaufar ➔ Maó)",
                "L92A": "L92a (Maó ➔ P. Prima)", "L92B": "L92b (P. Prima ➔ Maó)",
                "L93A": "L93a (Maó ➔ Binibèquer)", "L93B": "L93b (Binibèquer ➔ Maó)",
                "L71A": "L71a (Maó ➔ S. Tomàs)", "L71B": "L71b (S. Tomàs ➔ Maó)",
                "L72A": "L72a (Ciu ➔ S. Tomàs)", "L72B": "L72b (S. Tomàs ➔ Ciu)",
                "L51A": "L51a (Maó ➔ Galdana)", "L51B": "L51b (Galdana ➔ Maó)",
                "L52A": "L52a (Ciu ➔ Galdana)", "L52B": "L52b (Galdana ➔ Ciu)",
                "L53A": "L53a (Ferr ➔ Galdana)", "L53B": "L53b (Galdana ➔ Ferr)",
                "L32A": "L32a (Maó ➔ Son Bou)", "L32B": "L32b (Son Bou ➔ Maó)"
            };

            let baseLinea = txt.split('-')[0];
            if (mapaServicios[baseLinea]) {
                this.miLineaInput = mapaServicios[baseLinea];
                this.miLinea = mapaServicios[baseLinea];
            }
        },

        seleccionarLineaModal(linea) {
            this.registrarActividad();
            this.miLineaInput = linea;
            this.miLinea = linea;
            this.mostrarModalZonas = false;

            const mapaInverso = {
                "L01a (Maó ➔ Ciu)": "L01A-", "L01b (Ciu ➔ Maó)": "L01B-",
                "L14a Exprés (Maó ➔ Ciu)": "L14A-", "L14b Exprés (Ciu ➔ Maó)": "L14B-",
                "L02a (Maó ➔ Castell)": "L02A-", "L02b (Castell ➔ Maó)": "L02B-",
                "L03a (Maó ➔ S. Lluís)": "L03A-", "L03b (S. Lluís ➔ Maó)": "L03B-",
                "L21a (Maó ➔ S. Climent)": "L21A-", "L21b (S. Climent ➔ Maó)": "L21B-",
                "L22a (Maó ➔ Canutells)": "L22A-", "L22b (Canutells ➔ Maó)": "L22B-",
                "L31a (Maó ➔ C. Porter)": "L31A-", "L31b (C. Porter ➔ Maó)": "L31B-",
                "L08a (Maó ➔ C. Porter)": "L08A-", "L08b (C. Porter ➔ Maó)": "L08B-",
                "L91a (Maó ➔ S'Algar)": "L91A-", "L91b (Alcaufar ➔ Maó)": "L91B-",
                "L92a (Maó ➔ P. Prima)": "L92A-", "L92b (P. Prima ➔ Maó)": "L92B-",
                "L93a (Maó ➔ Binibèquer)": "L93A-", "L93b (Binibèquer ➔ Maó)": "L93B-",
                "L71a (Maó ➔ S. Tomàs)": "L71A-", "L71b (S. Tomàs ➔ Maó)": "L71B-",
                "L72a (Ciu ➔ S. Tomàs)": "L72A-", "L72b (S. Tomàs ➔ Ciu)": "L72B-",
                "L51a (Maó ➔ Galdana)": "L51A-", "L51b (Galdana ➔ Maó)": "L51B-",
                "L52a (Ciu ➔ Galdana)": "L52A-", "L52b (Galdana ➔ Ciu)": "L52B-",
                "L53a (Ferr ➔ Galdana)": "L53A-", "L53b (Galdana ➔ Ferr)": "L53B-",
                "L32a (Maó ➔ Son Bou)": "L32A-", "L32b (Son Bou ➔ Maó)": "L32B-"
            };

            if (mapaInverso[linea]) {
                let numBus = this.extraerNumeroCoche(this.miBusInput);
                this.miBusInput = mapaInverso[linea] + numBus;
            }

            if (this.sesionIniciada) {
                this.cargarParadas();
                this.reiniciarEscuchasFirebase();
                this.actualizarMiEstadoBD();
            }
        },

        extraerNumeroCoche(texto) {
            if (!texto) return '';
            let partes = texto.split('-');
            return partes[1] || '';
        },

        limpiarSesionEnBD() {
            if (this.miBus) {
                db.collection("bustalk_buses").doc(this.miBus).delete().catch(() => {});
            }
        },

        rotarModoColor() {
            this.registrarActividad();
            if (this.modoColor === 'noche') this.modoColor = 'gris';
            else if (this.modoColor === 'gris') this.modoColor = 'crema';
            else this.modoColor = 'noche';
            
            idb.set('bustalk_modo_color_v2', this.modoColor);
        },

        obtenerClaseModo() {
            if (this.modoColor === 'gris') return 'modo-dia-gris';
            if (this.modoColor === 'crema') return 'modo-dia-crema';
            return 'modo-noche';
        },

        obtenerColorPax(cantidad) {
            if (cantidad >= 75) return 'pax-limite';
            if (cantidad >= 50) return 'pax-lleno';
            return 'pax-verde-intenso';
        },

        formatearMinutosCuentaAtras(m) {
            return `${m}m`;
        },

        extraerOrigenTramo(tramo) {
            if (!tramo) return '';
            let partes = tramo.replace(/^De\s+/i, '').split(/\s+a\s+/i);
            return partes[0] || tramo;
        },

        extraerDestinoTramo(tramo) {
            if (!tramo) return '';
            let partes = tramo.replace(/^De\s+/i, '').split(/\s+a\s+/i);
            return partes[1] || '';
        },

        obtenerDestinoSiguiente() {
            let idx = this.misParadasArray.indexOf(this.miUbicacion);
            if (idx !== -1 && idx < this.misParadasArray.length - 1) {
                return this.misParadasArray[idx + 1];
            }
            return '';
        },

        cargarParadas() {
            const diccionario = {
                "L01a (Maó ➔ Ciu)": ["Maó", "Argen", "Alaior P.", "Alaior C.", "Mer", "Ferr", "Ciu"],
                "L01b (Ciu ➔ Maó)": ["Ciu", "Ferr", "Mer", "Alaior C.", "Alaior P.", "Argen", "Maó"],
                "L14a Exprés (Maó ➔ Ciu)": ["Maó", "Ciu"],
                "L14b Exprés (Ciu ➔ Maó)": ["Ciu", "Maó"],
                "L02a (Maó ➔ Castell)": ["Maó", "Fontanilles", "Castell"],
                "L02b (Castell ➔ Maó)": ["Castell", "Fontanilles", "Maó"],
                "L03a (Maó ➔ S. Lluís)": ["Maó", "H. Mateu Orfila", "S. Lluís"],
                "L03b (S. Lluís ➔ Maó)": ["S. Lluís", "H. Mateu Orfila", "Maó"],
                "L21a (Maó ➔ S. Climent)": ["Maó", "S. Climent"],
                "L21b (S. Climent ➔ Maó)": ["S. Climent", "Maó"],
                "L22a (Maó ➔ Canutells)": ["Maó", "S. Climent", "Canutells"],
                "L22b (Canutells ➔ Maó)": ["Canutells", "S. Climent", "Maó"],
                "L31a (Maó ➔ C. Porter)": ["Maó", "Alaior P.", "Alaior C.", "C. Porter"],
                "L31b (C. Porter ➔ Maó)": ["C. Porter", "Alaior C.", "Alaior P.", "Maó"],
                "L08a (Maó ➔ C. Porter)": ["Maó", "S. Climent", "C. Porter"],
                "L08b (C. Porter ➔ Maó)": ["C. Porter", "S. Climent", "Maó"],
                "L91a (Maó ➔ S'Algar)": ["Maó", "S. Lluís", "S'Algar", "Alcaufar"],
                "L91b (Alcaufar ➔ Maó)": ["Alcaufar", "S'Algar", "S. Lluís", "Maó"],
                "L92a (Maó ➔ P. Prima)": ["Maó", "S. Lluís", "P. Prima"],
                "L92b (P. Prima ➔ Maó)": ["P. Prima", "S. Lluís", "Maó"],
                "L93a (Maó ➔ Binibèquer)": ["Maó", "S. Lluís", "Binibèquer"],
                "L93b (Binibèquer ➔ Maó)": ["Binibèquer", "S. Lluís", "Maó"],
                "L52a (Ciu ➔ Galdana)": ["Ciu", "Ferr", "Cementerio", "Camping", "C. Mitjana", "Galdana"],
                "L52b (Galdana ➔ Ciu)": ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr", "Ciu"],
                "L51a (Maó ➔ Galdana)": ["Maó", "Argen", "Alaior P.", "Alaior C.", "Mer", "Ferr", "Cementerio", "Camping", "C. Mitjana", "Galdana"],
                "L51b (Galdana ➔ Maó)": ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr", "Mer", "Alaior C.", "Alaior P.", "Argen", "Maó"],
                "L53a (Ferr ➔ Galdana)": ["Ferr", "Cementerio", "Camping", "C. Mitjana", "Galdana"],
                "L53b (Galdana ➔ Ferr)": ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr"],
                "L72a (Ciu ➔ S. Tomàs)": ["Ciu", "Ferr", "Mer", "Migjorn", "S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª"],
                "L72b (S. Tomàs ➔ Ciu)": ["S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª", "Migjorn", "Mer", "Ferr", "Ciu"],
                "L71a (Maó ➔ S. Tomàs)": ["Maó", "Argen", "Alaior P.", "Alaior C.", "Migjorn", "S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª"],
                "L71b (S. Tomàs ➔ Maó)": ["S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª", "Migjorn", "Alaior C.", "Alaior P.", "Argen", "Maó"],
                "L32a (Maó ➔ Son Bou)": ["Maó", "Argen", "Alaior P.", "Alaior C.", "Son Bou"],
                "L32b (Son Bou ➔ Maó)": ["Son Bou", "Alaior C.", "Alaior P.", "Argen", "Maó"],
                "Zona Maó y Levante": ["Maó", "Castell", "S.Lluís", "P.Prima", "S'Algar", "Canutells", "Mesquida", "C.Porter", "Binisafúller", "Binibèquer", "Alcaufar", "Trebalúger", "Bintaufa", "S.Climent"],
                "Zona Centro y Poniente": ["Ciu", "Ferr", "Mer", "Alaior C.", "Migjorn", "S. Tomàs 1ª", "Son Bou", "Galdana"]
            };
            let paradas = diccionario[this.miLinea] || ["Maó", "Argen", "Alaior P.", "Alaior C.", "Mer", "Ferr", "Ciu"];
            this.misParadasArray = paradas;
            this.miUbicacion = paradas[0];
            this.evaluarSentidoIda();
        },

        evaluarSentidoIda() {
            if (this.miLinea.includes('a (')) {
                this.esSentidoIda = true;
            } else if (this.miLinea.includes('b (')) {
                this.esSentidoIda = false;
            } else if (this.misParadasArray.length > 0) {
                const origen = this.misParadasArray[0];
                this.esSentidoIda = (origen === 'Maó' || origen.includes('Maó'));
            }
        },

        obtenerTiempoTramo(origen, destino) {
            const tiempos = {
                "Ciu-Ferr": 20, "Ferr-Mer": 10, "Mer-Alaior C.": 10, "Alaior C.-Alaior P.": 3, "Alaior P.-Argen": 5, "Argen-Maó": 12,
                "Maó-Argen": 12, "Argen-Alaior P.": 5, "Alaior P.-Alaior C.": 3, "Alaior C.-Mer": 10, "Mer-Ferr": 10, "Ferr-Ciu": 20,
                "Ciu-Maó": 45, "Maó-Ciu": 45,
                "Maó-Fontanilles": 5, "Fontanilles-Castell": 5, "Castell-Fontanilles": 5, "Fontanilles-Maó": 5,
                "Maó-H. Mateu Orfila": 6, "H. Mateu Orfila-S. Lluís": 6, "S. Lluís-H. Mateu Orfila": 6, "H. Mateu Orfila-Maó": 6,
                "Maó-S. Climent": 8, "S. Climent-Maó": 8,
                "S. Climent-Canutells": 7, "Canutells-S. Climent": 7,
                "Maó-Alaior P.": 12, "Alaior C.-C. Porter": 13, "C. Porter-Alaior C.": 13,
                "S. Climent-C. Porter": 12, "C. Porter-S. Climent": 12,
                "Maó-S. Lluís": 8, "S. Lluís-S'Algar": 7, "S'Algar-Alcaufar": 3, "Alcaufar-S'Algar": 3, "S'Algar-S. Lluís": 7, "S. Lluís-Maó": 8,
                "S. Lluís-P. Prima": 7, "P. Prima-S. Lluís": 7,
                "S. Lluís-Binibèquer": 10, "Binibèquer-S. Lluís": 10,
                "Ferr-Galdana": 10, "Galdana-Ferr": 10,
                "Ferr-Cementerio": 2, "Cementerio-Camping": 4, "Camping-C. Mitjana": 2, "C. Mitjana-Galdana": 2,
                "Galdana-C. Mitjana": 2, "C. Mitjana-Camping": 2, "Camping-Cementerio": 4, "Cementerio-Ferr": 2,
                "Mer-Migjorn": 12, "Migjorn-Mer": 12,
                "Migjorn-S. Tomàs 1ª": 8, "S. Tomàs 1ª-S. Tomàs 2ª": 1, "S. Tomàs 2ª-S. Tomàs 3ª": 2,
                "S. Tomàs 3ª-Migjorn": 8, "S. Tomàs 1ª-Migjorn": 8,
                "Alaior C.-Migjorn": 12, "Migjorn-Alaior C.": 12,
                "Alaior C.-Son Bou": 20, "Son Bou-Alaior C.": 20
            };
            return tiempos[`${origen}-${destino}`] || 10;
        },

        esMismaZona(lineaA, lineaB) {
            if (!lineaA || !lineaB) return false;
            if (lineaA === 'General' || lineaB === 'General') return true;
            
            const esL14_A = lineaA.includes('L14');
            const esL14_B = lineaB.includes('L14');
            if (esL14_A || esL14_B) {
                return esL14_A && esL14_B;
            }

            if (lineaA === lineaB) return true;
            
            const poniente = [
                "Zona Centro y Poniente", 
                "L01a", "L01b", "L01", "L1",
                "L52a", "L52b", "L51a", "L51b", "L53a", "L53b", 
                "L72a", "L72b", "L71a", "L71b", "L32a", "L32b"
            ];
            
            const pertenecePonienteA = poniente.some(p => lineaA.includes(p));
            const pertenecePonienteB = poniente.some(p => lineaB.includes(p));
            if (pertenecePonienteA && pertenecePonienteB) return true;
            
            const levante = [
                "Zona Maó y Levante", "L02a", "L02b", "L03a", "L03b", 
                "L21a", "L21b", "L22a", "L22b", "L31a", "L31b", 
                "L08a", "L08b", "L91a", "L91b", "L92a", "L92b", "L93a", "L93b"
            ];
            const perteneceLevanteA = levante.some(l => lineaA.includes(l));
            const perteneceLevanteB = levante.some(l => lineaB.includes(l));
            if (perteneceLevanteA && perteneceLevanteB) return true;
            
            return false;
        },

        invertirRuta() {
            this.registrarActividad();
            this.esTerminalGaldana = (this.miUbicacion === 'Galdana');
            this.esTerminalTomas = (this.miUbicacion === 'S. Tomàs 1ª' || this.miUbicacion === 'S. Tomàs 3ª');
            this.mostrarModalResumen = true;
        },

        confirmarCierreResumen() {
            this.registrarActividad();
            this.mostrarModalResumen = false;

            this.limpiarSesionEnBD();

            let numBus = this.extraerNumeroCoche(this.miBus);
            
            if (this.miLinea.includes('a (')) {
                this.miLinea = this.miLinea.replace('a (', 'b (');
                let codigoNuevo = this.obtenerCodigoLineaActual();
                this.miBus = codigoNuevo + (numBus ? '-' + numBus : '');
            } else if (this.miLinea.includes('b (')) {
                this.miLinea = this.miLinea.replace('b (', 'a (');
                let codigoNuevo = this.obtenerCodigoLineaActual();
                this.miBus = codigoNuevo + (numBus ? '-' + numBus : '');
            }

            idb.set('bustalk_bus', this.miBus);
            idb.set('bustalk_linea', this.miLinea);

            this.misParadasArray = this.misParadasArray.slice().reverse();
            this.miUbicacion = this.misParadasArray[0];
            this.evaluarSentidoIda();
            
            this.segundosEnParadaActual = 0;
            this.ultimoAvisoParadaSegs = 0;
            this.acumuladoParadasTrayecto = 0;
            this.acumuladoRetrasoTráfico = 0;
            this.ultimoTiempoParadoCongelado = 0;
            this.inicioParadaTimestamp = Date.now();
            this.mostrarAvisoApagarRadio = false;
            this.avisoDescartadoManualEstado = false;

            if ("vibrate" in navigator) navigator.vibrate(50);
            this.actualizarMiEstadoBD();
        },

        cambiarServicioGaldana(lineaDestino) {
            this.registrarActividad();
            this.limpiarSesionEnBD();

            let numBus = this.extraerNumeroCoche(this.miBus);
            let sufijoBus = numBus ? '-' + numBus : '';

            if (lineaDestino === 'L51b') {
                this.miBus = "L51B" + sufijoBus;
                this.miLinea = "L51b (Galdana ➔ Maó)";
                this.miLineaInput = "L51b (Galdana ➔ Maó)";
                this.misParadasArray = ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr", "Mer", "Alaior C.", "Alaior P.", "Argen", "Maó"];
            } else if (lineaDestino === 'L52b') {
                this.miBus = "L52B" + sufijoBus;
                this.miLinea = "L52b (Galdana ➔ Ciu)";
                this.miLineaInput = "L52b (Galdana ➔ Ciu)";
                this.misParadasArray = ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr", "Ciu"];
            } else if (lineaDestino === 'L53b') {
                this.miBus = "L53B" + sufijoBus;
                this.miLinea = "L53b (Galdana ➔ Ferr)";
                this.miLineaInput = "L53b (Galdana ➔ Ferr)";
                this.misParadasArray = ["Galdana", "C. Mitjana", "Camping", "Cementerio", "Ferr"];
            }
            
            idb.set('bustalk_bus', this.miBus);
            idb.set('bustalk_linea', this.miLinea);
            this.miUbicacion = "Galdana";
            this.enParada = true;
            this.esSentidoIda = false;
            
            this.mostrarModalResumen = false;
            this.segundosEnParadaActual = 0;
            this.ultimoAvisoParadaSegs = 0;
            this.acumuladoParadasTrayecto = 0;
            this.acumuladoRetrasoTráfico = 0;
            this.ultimoTiempoParadoCongelado = 0;
            this.inicioParadaTimestamp = Date.now();
            this.mostrarAvisoApagarRadio = false;
            this.avisoDescartadoManualEstado = false;

            if ("vibrate" in navigator) navigator.vibrate(50);
            this.reiniciarEscuchasFirebase();
            this.actualizarMiEstadoBD();
        },

        cambiarServicioTomas(lineaDestino) {
            this.registrarActividad();
            this.limpiarSesionEnBD();

            let numBus = this.extraerNumeroCoche(this.miBus);
            let sufijoBus = numBus ? '-' + numBus : '';

            if (lineaDestino === 'L71b') {
                this.miBus = "L71B" + sufijoBus;
                this.miLinea = "L71b (S. Tomàs ➔ Maó)";
                this.miLineaInput = "L71b (S. Tomàs ➔ Maó)";
                this.misParadasArray = ["S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª", "Migjorn", "Alaior C.", "Alaior P.", "Argen", "Maó"];
            } else if (lineaDestino === 'L72b') {
                this.miBus = "L72B" + sufijoBus;
                this.miLinea = "L72b (S. Tomàs ➔ Ciu)";
                this.miLineaInput = "L72b (S. Tomàs ➔ Ciu)";
                this.misParadasArray = ["S. Tomàs 1ª", "S. Tomàs 2ª", "S. Tomàs 3ª", "Migjorn", "Mer", "Ferr", "Ciu"];
            }
            
            idb.set('bustalk_bus', this.miBus);
            idb.set('bustalk_linea', this.miLinea);
            this.miUbicacion = "S. Tomàs 1ª";
            this.enParada = true;
            this.esSentidoIda = false;
            
            this.mostrarModalResumen = false;
            this.segundosEnParadaActual = 0;
            this.ultimoAvisoParadaSegs = 0;
            this.acumuladoParadasTrayecto = 0;
            this.acumuladoRetrasoTráfico = 0;
            this.ultimoTiempoParadoCongelado = 0;
            this.inicioParadaTimestamp = Date.now();
            this.mostrarAvisoApagarRadio = false;
            this.avisoDescartadoManualEstado = false;

            if ("vibrate" in navigator) navigator.vibrate(50);
            this.reiniciarEscuchasFirebase();
            this.actualizarMiEstadoBD();
        },

        reiniciarEscuchasFirebase() {
            if (this.unsubBuses) this.unsubBuses();
            if (this.unsubRadio) this.unsubRadio();

            this.unsubBuses = db.collection("bustalk_buses").onSnapshot(snap => {
                const lista = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    if (doc.id !== this.miBus) {
                        if (this.esMismaZona(this.miLinea, data.linea)) {
                            if (data.timestamp > Date.now() - (2 * 60 * 60 * 1000)) {
                                lista.push({ id: doc.id, ...data });
                            }
                        }
                    }
                });
                this.compañeros = lista.sort((a, b) => b.pax - a.pax);
            });

            this.unsubRadio = db.collection("bustalk_radio").orderBy("timestamp", "desc").limit(20)
                .onSnapshot(snap => {
                    if (snap.empty) return;
                    
                    for (let i = 0; i < snap.docs.length; i++) {
                        const data = snap.docs[i].data();
                        const mLinea = data.linea || '';
                        if (this.esMismaZona(this.miLinea, mLinea)) {
                            this.ultimoAudio = data.audioBase64;
                            break; 
                        }
                    }

                    const msg = snap.docs[0].data();
                    const msgId = snap.docs[0].id;
                    const mLineaRadio = msg.linea || '';
                    
                    if (msg.bus !== this.miBus && this.streamingMsgId !== msgId) {
                        if (this.esMismaZona(this.miLinea, mLineaRadio)) {
                            this.streamingMsgId = msgId;
                            this.reproducirMensaje(msg.audioBase64, msg.bus, msg.linea);
                        }
                    }
                });
        },

        async mantenerPantallaDespierta() {
            if ('wakeLock' in navigator) {
                try { this.wakeLockStatus = await navigator.wakeLock.request('screen'); } catch (err) {}
            }
        },

        iniciarTurno() {
            this.registrarActividad();
            let busNormalizado = this.miBusInput.trim().toUpperCase();
            if (!busNormalizado || busNormalizado === '') { 
                alert("Por favor, introduce el servicio de tu autobús."); 
                return; 
            }
            if (!busNormalizado.startsWith('L') && busNormalizado !== 'ESCOLAR' && busNormalizado !== 'DISCRECIONAL') {
                alert("⚠️ Atención: Debes incluir la letra 'L' en el número de servicio (Ejemplo: L01A-56, L02A-12).");
                return;
            }

            if (busNormalizado.endsWith('-')) {
                busNormalizado = busNormalizado.replace(/-$/, '');
            }

            if (!this.miLineaInput || this.miLineaInput.trim() === '') { 
                alert("Por favor, selecciona una línea o zona."); 
                return; 
            }
            
            navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false, 
                    autoGainControl: true,
                    sampleRate: 44100
                } 
            }).then(stream => {
                stream.getTracks().forEach(track => track.stop());
                
                this.miBus = busNormalizado;
                this.miLinea = this.miLineaInput;
                
                this.cargarParadas();

                idb.set('bustalk_bus', this.miBus);
                idb.set('bustalk_linea', this.miLinea);
                this.sesionIniciada = true;

                this.mantenerPantallaDespierta();
                
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        this.mantenerPantallaDespierta();
                        if (this.conectado) this.actualizarMiEstadoBD();
                    }
                });

                this.playAudioAviso('local');

                auth.signInAnonymously().then(() => {
                    this.conectado = true;
                    this.inicioParadaTimestamp = Date.now();
                    this.actualizarMiEstadoBD();
                    this.reiniciarEscuchasFirebase();
                }).catch((error) => { 
                    this.conectado = false; this.sesionIniciada = false;
                    alert("❌ Error: " + error.message); 
                });

            }).catch(err => {
                alert("⚠️ Permiso Denegado: Debes permitir el acceso al micrófono de tu dispositivo para usar BusTalk en la ruta.");
            });
        },

        cerrarTurno() {
            this.registrarActividad();
            if(confirm("¿Apagar la radio y salir del turno?")) {
                if(this.unsubBuses) this.unsubBuses();
                if(this.unsubRadio) this.unsubRadio();
                this.limpiarSesionEnBD();
                idb.remove('bustalk_bus');
                idb.remove('bustalk_linea');
                location.reload();
            }
        },

        irAlGarajeFinTurno() {
            this.registrarActividad();
            this.mostrarAvisoFinalRuta = false;
            this.cerrarTurno();
        },

        iniciarPax(valor) {
            this.registrarActividad();
            this.cambiarPasajerosUnico(valor);
            this.intervaloPax = setInterval(() => { this.cambiarPasajerosUnico(valor); }, 150);
        },
        cambiarPasajerosUnico(valor) {
            this.miPax = Math.max(0, this.miPax + valor);
            if ("vibrate" in navigator) navigator.vibrate(10);
        },
        pararPax() {
            if(this.intervaloPax) {
                clearInterval(this.intervaloPax);
                this.intervaloPax = null;
                this.actualizarMiEstadoBD();
            }
        },

        actualizarUbicacion(lugar) {
            this.registrarActividad();
            let idxPrevio = this.misParadasArray.indexOf(this.miUbicacion);
            let esIntermedia = (idxPrevio > 0 && idxPrevio < this.misParadasArray.length - 1);
            
            if (this.enParada && esIntermedia) {
                this.acumuladoParadasTrayecto += this.segundosEnParadaActual;
            }
            
            this.miUbicacion = lugar; 
            this.enParada = true; 
            this.etaFinal = null; 
            this.miTramoActual = '';
            this.segundosEnParadaActual = 0;
            this.ultimoAvisoParadaSegs = 0;
            this.inicioParadaTimestamp = Date.now();
            this.mostrarAvisoApagarRadio = false;
            this.avisoDescartadoManualEstado = false;
            this.verificarFinalRuta();
            this.actualizarMiEstadoBD();
            
            if ("vibrate" in navigator) navigator.vibrate(50);
        },

        toggleParada() {
            this.registrarActividad();
            let idx = this.misParadasArray.indexOf(this.miUbicacion);
            let esIntermedia = (idx > 0 && idx < this.misParadasArray.length - 1);

            if (this.enParada) {
                this.enParada = false;
                this.mostrarAvisoApagarRadio = false;
                this.avisoDescartadoManualEstado = false;
                this.mostrarAvisoFinalRuta = false;
                
                if (this.miAlerta === 'RETENCIÓN') this.miAlerta = null;

                this.ultimoTiempoParadoCongelado = this.segundosEnParadaActual;
                if (esIntermedia) {
                    this.acumuladoParadasTrayecto += this.segundosEnParadaActual;
                }

                if (idx !== -1 && idx < this.misParadasArray.length - 1) {
                    let siguiente = this.misParadasArray[idx + 1];
                    this.minutosRuta = this.obtenerTiempoTramo(this.miUbicacion, siguiente);
                    this.miTramoActual = `De ${this.miUbicacion} a ${siguiente}`;
                } else {
                    this.miTramoActual = `En ruta desde ${this.miUbicacion}`;
                }
                
                this.etaFinal = Date.now() + (this.minutosRuta * 60 * 1000);
                this.minutosRestantes = this.minutosRuta;
                
            } else {
                if (this.minutosRestantes < 0) {
                    this.acumuladoRetrasoTráfico += Math.abs(this.minutosRestantes);
                }

                this.enParada = true;
                this.etaFinal = null;
                this.miTramoActual = '';
                this.segundosEnParadaActual = 0;
                this.ultimoAvisoParadaSegs = 0;
                this.inicioParadaTimestamp = Date.now();
                this.avisoDescartadoManualEstado = false;
                
                if (idx !== -1 && idx < this.misParadasArray.length - 1) {
                    this.miUbicacion = this.misParadasArray[idx + 1];
                    this.playAudioAviso('salto');
                }
                this.verificarFinalRuta();
            }
            
            this.actualizarMiEstadoBD();
            if ("vibrate" in navigator) navigator.vibrate(50);
        },

        verificarFinalRuta() {
            let idx = this.misParadasArray.indexOf(this.miUbicacion);
            
            if (this.miUbicacion === 'S. Tomàs 1ª' && this.enParada) {
                this.esTerminalTomas = true;
                this.mostrarAvisoFinalRuta = true;
                return;
            }

            if (idx === this.misParadasArray.length - 1 && this.enParada) {
                this.esTerminalGaldana = (this.miUbicacion === 'Galdana');
                this.mostrarAvisoFinalRuta = true;
            }
        },

        aceptarCambioSentido() {
            this.registrarActividad();
            this.mostrarAvisoFinalRuta = false;
            this.invertirRuta();
        },

        formatearTiempoSegundos(seg) {
            if (!seg || seg < 0) seg = 0;
            const m = Math.floor(seg / 60);
            const s = seg % 60;
            return `${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
        },

        forzarRefrescoCompañero(idBus) {
            this.registrarActividad();
            db.collection("bustalk_buses").doc(idBus).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const idx = this.compañeros.findIndex(c => c.id === idBus);
                    if (idx !== -1) {
                        this.compañeros[idx] = { id: idBus, ...data };
                        this.compañeros = [...this.compañeros];
                    }
                }
            });
            if ("vibrate" in navigator) navigator.vibrate(30);
        },

        ajustarMinutos(val) {
            this.registrarActividad();
            if (!this.enParada && this.etaFinal) {
                this.etaFinal += (val * 60000);
                this.minutosRestantes = Math.ceil((this.etaFinal - Date.now()) / 60000);
            }
            this.actualizarMiEstadoBD();
        },

        toggleAlerta(tipo) {
            this.registrarActividad();
            if (this.miAlerta === tipo) this.miAlerta = null; 
            else this.miAlerta = tipo; 
            this.actualizarMiEstadoBD();
            if ("vibrate" in navigator) navigator.vibrate(50);
        },

        actualizarMiEstadoBD() {
            if(!this.conectado) return;
            db.collection("bustalk_buses").doc(this.miBus).set({
                linea: this.miLinea, pax: this.miPax, ubicacion: this.miUbicacion,
                enParada: this.enParada, tramo: this.miTramoActual, 
                sentido: this.esSentidoIda ? 'ida' : 'vuelta', 
                eta: this.etaFinal, alerta: this.miAlerta, timestamp: Date.now()
            });
        },

        calcularMinutos(etaMs) {
            if(!etaMs) return 0;
            const diff = etaMs - Date.now();
            return Math.max(0, Math.ceil(diff / 60000));
        },

        alternarGrabacionToque() {
            this.registrarActividad();
            if (this.estadoRadio === 'recibiendo') return;

            if (this.estadoRadio === 'reposo') {
                navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: false, 
                        autoGainControl: true,
                        sampleRate: 44100
                    } 
                }).then(stream => {
                    this.streamActivo = stream;
                    this.estadoRadio = 'grabando';
                    if ("vibrate" in navigator) navigator.vibrate(100); 

                    this.chunks = [];
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.mediaRecorder.ondataavailable = e => { this.chunks.push(e.data); };

                    clearTimeout(this.temporizadorSeguridadMic);
                    this.temporizadorSeguridadMic = setTimeout(() => {
                        if (this.estadoRadio === 'grabando') {
                            this.playAudioAviso('cierre_mic');
                            this.alternarGrabacionToque();
                        }
                    }, 10000);

                    this.mediaRecorder.onstop = async () => {
                        clearTimeout(this.temporizadorSeguridadMic);
                        const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
                        const base64Audio = await this.blobToBase64(audioBlob);

                        const canalEnvio = this.modoGlobal ? 'General' : this.miLinea;

                        db.collection("bustalk_radio").add({
                            bus: this.miBus, linea: canalEnvio,
                            audioBase64: base64Audio, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        if (this.streamActivo) {
                            this.streamActivo.getTracks().forEach(track => track.stop());
                            this.streamActivo = null;
                        }
                        
                        if (this.modoGlobal) this.modoGlobal = false;
                    };
                    this.mediaRecorder.start();
                }).catch(err => { alert("Micrófono no disponible."); });

            } else if (this.estadoRadio === 'grabando') {
                clearTimeout(this.temporizadorSeguridadMic);
                if (this.mediaRecorder) {
                    this.mediaRecorder.stop();
                    this.estadoRadio = 'reposo';
                    if ("vibrate" in navigator) navigator.vibrate(50);
                }
            }
        },

        reproducirMensaje(base64, busSender, lineaMensaje) {
            this.estadoRadio = 'recibiendo'; 
            this.elQueHabla = busSender;
            this.lineaQueHabla = lineaMensaje === 'General' ? 'GLOBAL / EMERGENCIA' : lineaMensaje;
            
            if ("vibrate" in navigator) navigator.vibrate([100, 100, 100]); 
            
            clearTimeout(this.watchdogRadio);
            this.watchdogRadio = setTimeout(() => { this.resetRadio(); }, 10000);

            const tipoSonido = lineaMensaje === 'General' ? 'global' : 'local';
            this.playAudioAviso(tipoSonido);
            
            const esperaVoz = lineaMensaje === 'General' ? 1400 : 500;

            setTimeout(() => {
                const audio = new Audio(base64);
                audio.play().catch(e => { console.log("Bloqueado"); this.resetRadio(); });
                
                audio.onended = () => { this.resetRadio(); };
                audio.onerror = () => { this.resetRadio(); };
            }, esperaVoz); 
        },

        repetirUltimoAudio() {
            this.registrarActividad();
            if (!this.ultimoAudio || this.estadoRadio !== 'reposo') return;
            this.estadoRadio = 'recibiendo';
            const audio = new Audio(this.ultimoAudio);
            audio.play().catch(e => { console.log("Bloqueado"); this.resetRadio(); });
            audio.onended = () => { this.resetRadio(); };
        },

        resetRadio() {
            this.estadoRadio = 'reposo'; this.elQueHabla = null; this.lineaQueHabla = '';
            clearTimeout(this.watchdogRadio);
        },

        blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.readAsDataURL(blob);
                reader.onloadend = () => resolve(reader.result); reader.onerror = reject;
            });
        },

        playAudioAviso(tipo) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (ctx.state === 'suspended') { ctx.resume(); }
                
                if(tipo === 'local') {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'triangle'; 
                    osc.frequency.setValueAtTime(1000, ctx.currentTime);
                    gain.gain.setValueAtTime(1.0, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                    osc.start(); osc.stop(ctx.currentTime + 0.3);
                } else if (tipo === 'cierre_mic') {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine'; 
                    osc.frequency.setValueAtTime(400, ctx.currentTime);
                    gain.gain.setValueAtTime(0.8, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                    osc.start(); osc.stop(ctx.currentTime + 0.2);
                } else if (tipo === 'global') {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'triangle'; 
                    osc.frequency.setValueAtTime(800, ctx.currentTime); 
                    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.6); 
                    
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.1); 
                    gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.5); 
                    
                    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.6); 
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2); 

                    osc.start(); osc.stop(ctx.currentTime + 1.2);
                } else if (tipo === 'salto') {
                    const osc = ctx.createOscillator(); const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine'; 
                    osc.frequency.setValueAtTime(1200, ctx.currentTime);
                    gain.gain.setValueAtTime(0.5, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
                    
                    const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
                    osc2.connect(gain2); gain2.connect(ctx.destination);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1500, ctx.currentTime + 0.15);
                    gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.15);
                    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                    osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.25);
                } else if (tipo === 'llegada') {
                    for (let i = 0; i < 2; i++) {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.type = 'square';
                        o.frequency.setValueAtTime(800, ctx.currentTime + (i * 0.4));
                        g.gain.setValueAtTime(1.0, ctx.currentTime + (i * 0.4));
                        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * 0.4) + 0.2);
                        o.start(ctx.currentTime + (i * 0.4)); 
                        o.stop(ctx.currentTime + (i * 0.4) + 0.2);
                    }
                } else if (tipo === 'aviso_parada_suave') {
                    for (let i = 0; i < 2; i++) {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.type = 'sine';
                        o.frequency.setValueAtTime(880, ctx.currentTime + (i * 0.2));
                        g.gain.setValueAtTime(0.6, ctx.currentTime + (i * 0.2));
                        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * 0.2) + 0.12);
                        o.start(ctx.currentTime + (i * 0.2)); 
                        o.stop(ctx.currentTime + (i * 0.2) + 0.12);
                    }
                } else if (tipo === 'aviso_parada_fuerte') {
                    for (let i = 0; i < 3; i++) {
                        const o = ctx.createOscillator(); const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.type = 'sawtooth';
                        o.frequency.setValueAtTime(1400, ctx.currentTime + (i * 0.15));
                        g.gain.setValueAtTime(0.8, ctx.currentTime + (i * 0.15));
                        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * 0.15) + 0.08);
                        o.start(ctx.currentTime + (i * 0.15)); 
                        o.stop(ctx.currentTime + (i * 0.15) + 0.08);
                    }
                }
            } catch (e) { }
        }
    }
}

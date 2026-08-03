// shared/bazl-share.js
// Formular-Freigabe für Mehrpersonen-Unterschriften: verschickt nur den Seiten-Link
// (via native "Teilen"-Übersicht oder Zwischenablage), nie ein Dokument/Anhang.
// Der geteilte Formular-Stand liegt in Supabase, referenziert per zufälliger UUID im
// ?share=-Query-Parameter — ohne diese UUID ist ein Datensatz nicht erreichbar.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://ofyjketkggfonqswrxos.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_H7EKPtKw-3BrgwkwVLBWYQ_RBmCzjGn';

  const RPC_BASE = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/';

  const STRINGS = {
    de: { loading: 'Lade gemeinsamen Stand …', loaded: 'Gemeinsamer Stand geladen (Freigabe aktiv)',
          emptyShared: 'Freigabe aktiv — noch kein gespeicherter Stand', loadError: 'Konnte gemeinsamen Stand nicht laden',
          sent: 'Geteilt', cancelled: 'Teilen abgebrochen',
          copied: 'Link kopiert — kann in einer beliebigen App eingefügt werden', shareError: 'Fehler beim Erstellen des Links',
          synced: 'Gespeichert & synchronisiert ', syncError: 'Gespeichert lokal — Synchronisation fehlgeschlagen',
          shareTitle: 'BAZL Formular – bitte ergänzen/unterschreiben',
          shareText: 'Bitte ergänzen und/oder unterschreiben Sie das Formular über folgenden Link (gemeinsamer Zwischenstand, keine endgültige Einreichung):' },
    en: { loading: 'Loading shared draft …', loaded: 'Shared draft loaded (sharing active)',
          emptyShared: 'Sharing active — nothing saved yet', loadError: 'Could not load shared draft',
          sent: 'Shared', cancelled: 'Sharing cancelled',
          copied: 'Link copied — paste it into any app', shareError: 'Error creating the link',
          synced: 'Saved & synced ', syncError: 'Saved locally — sync failed',
          shareTitle: 'BAZL form – please complete/sign',
          shareText: 'Please complete and/or sign the form via the following link (shared work-in-progress draft, not a final submission):' },
    fr: { loading: 'Chargement de l’état partagé …', loaded: 'État partagé chargé (partage actif)',
          emptyShared: 'Partage actif — rien d’enregistré pour l’instant', loadError: 'Impossible de charger l’état partagé',
          sent: 'Partagé', cancelled: 'Partage annulé',
          copied: 'Lien copié — à coller dans l’application de votre choix', shareError: 'Erreur lors de la création du lien',
          synced: 'Enregistré et synchronisé ', syncError: 'Enregistré localement — échec de la synchronisation',
          shareTitle: 'Formulaire BAZL – à compléter/signer',
          shareText: 'Veuillez compléter et/ou signer le formulaire via le lien suivant (état de travail partagé, pas un dépôt définitif) :' },
    it: { loading: 'Caricamento stato condiviso …', loaded: 'Stato condiviso caricato (condivisione attiva)',
          emptyShared: 'Condivisione attiva — nessun dato salvato', loadError: 'Impossibile caricare lo stato condiviso',
          sent: 'Condiviso', cancelled: 'Condivisione annullata',
          copied: 'Link copiato — incollalo nell’app che preferisci', shareError: 'Errore nella creazione del link',
          synced: 'Salvato e sincronizzato ', syncError: 'Salvato localmente — sincronizzazione non riuscita',
          shareTitle: 'Modulo BAZL – da completare/firmare',
          shareText: 'La preghiamo di completare e/o firmare il modulo tramite il seguente link (bozza condivisa in lavorazione, non un invio definitivo):' },
  };
  const t = STRINGS[document.documentElement.lang] || STRINGS.de;

  const form = document.getElementById('bazlForm');
  const statusText = document.getElementById('statusText');
  const shareBtn = document.getElementById('shareBtn');
  if (!form || !shareBtn) return;

  const FORM_KEY = form.dataset.formKey;
  function setStatus(msg) { if (statusText) statusText.textContent = msg; }

  function getShareId() { return new URLSearchParams(window.location.search).get('share'); }
  function setShareIdInUrl(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('share', id);
    history.replaceState(null, '', url.toString());
  }

  async function rpc(name, body) {
    const res = await fetch(RPC_BASE + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Supabase RPC ' + name + ' failed: ' + res.status);
    return res.json();
  }
  async function fetchDraft(id) {
    const rows = await rpc('get_form_draft', { p_id: id });
    return rows && rows.length ? rows[0] : null;
  }
  async function pushDraft(id) {
    if (typeof window.bazlCollectData !== 'function') return;
    await rpc('upsert_form_draft', { p_id: id, p_form_key: FORM_KEY, p_data: window.bazlCollectData() });
  }

  let shareId = getShareId();

  (async function initFromShareLink() {
    if (!shareId) return;
    setStatus(t.loading);
    try {
      const row = await fetchDraft(shareId);
      if (row && row.data && typeof window.bazlApplyData === 'function') {
        window.bazlApplyData(row.data);
        setStatus(t.loaded);
      } else {
        setStatus(t.emptyShared);
      }
    } catch (err) {
      console.error(err);
      setStatus(t.loadError);
    }
  })();

  shareBtn.addEventListener('click', async function () {
    shareBtn.disabled = true;
    try {
      if (!shareId) shareId = crypto.randomUUID();
      await pushDraft(shareId);
      setShareIdInUrl(shareId);
      const link = window.location.href;
      if (navigator.share) {
        // Native Teilen-Übersicht: Nutzer wählt Mail/WhatsApp/Nachrichten/Teams/... selbst.
        // `url` ist ein eigenes Feld (nicht in `text` eingebettet), damit Ziel-Apps den
        // Link nicht doppelt anzeigen.
        try {
          await navigator.share({ title: t.shareTitle, text: t.shareText, url: link });
          setStatus(t.sent);
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') {
            setStatus(t.cancelled); // Nutzer hat die Teilen-Übersicht ohne Auswahl geschlossen
          } else {
            throw shareErr;
          }
        }
      } else {
        // Fallback für Plattformen ohne Web Share API (v.a. Desktop-Firefox): Link in
        // die Zwischenablage, Nutzer fügt ihn selbst in eine beliebige App ein.
        await navigator.clipboard.writeText(link);
        setStatus(t.copied);
      }
    } catch (err) {
      console.error(err);
      setStatus(t.shareError);
    } finally {
      shareBtn.disabled = false;
    }
  });

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      if (!shareId) return; // normale, nicht geteilte Sitzung: unverändert, keine Netzwerkaufrufe
      pushDraft(shareId)
        .then(function () { setStatus(t.synced + new Date().toLocaleTimeString()); })
        .catch(function (err) { console.error(err); setStatus(t.syncError); });
    });
  }
})();

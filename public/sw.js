/**
 * Service Worker — Push-Benachrichtigungen für Partsunion Mail.
 *
 * Bewusst OHNE Offline-Zwischenspeicher.
 *
 * Ein Cache für eine Mail-Anwendung ist keine kleine Zutat, sondern eine
 * zweite Wahrheit: veraltete Nachrichtenlisten, gelesene Post, die wieder
 * ungelesen erscheint, ein Entwurf aus einer alten Sitzung. Und bei einer
 * Anwendung mit Postfachtrennung wäre ein Cache eine Kopie fremder Post im
 * Browserprofil, die keine Rechteprüfung mehr kennt — wer sich abmeldet und
 * ein Kollege sich anmeldet, bekäme sonst unter Umständen alte Antworten
 * serviert. Der Gewinn wäre ein Startbildschirm ohne Netz; der Preis ist zu
 * hoch. Diese Datei tut daher genau zwei Dinge: klingeln und beim Antippen
 * das richtige Fenster öffnen.
 *
 * Die Nutzlast enthält absichtlich weder Betreff noch Absender — sie läuft
 * über die Server von Google/Apple/Mozilla. Siehe pushService.ts im Backend.
 */

self.addEventListener('install', (event) => {
    // Sofort übernehmen: bei einer Anwendung ohne Cache gibt es nichts, was
    // eine alte Fassung noch bräuchte.
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let daten = {};
    try {
        daten = event.data ? event.data.json() : {};
    } catch {
        daten = {};
    }

    if (daten.typ !== 'neue-mail') return;

    const postfach = typeof daten.postfach === 'string' ? daten.postfach : 'Ihrem Postfach';

    event.waitUntil(
        self.registration.showNotification('Neue E-Mail', {
            body: `Neue Nachricht in ${postfach}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            // Gleiches Tag je Postfach: zehn Mails in einer Minute ergeben eine
            // Meldung, nicht zehn. renotify sorgt dafür, dass es trotzdem jedes
            // Mal klingelt.
            tag: `mail-${postfach}`,
            renotify: true,
            data: { postfach, nachrichtId: daten.nachrichtId || null },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Ein vorhandenes Fenster bekommt den Fokus, statt ein zweites zu öffnen —
    // sonst hat man nach einem Vormittag acht Tabs mit demselben Postfach.
    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        for (const client of clients) {
            if (new URL(client.url).pathname.startsWith('/mail')) {
                await client.focus();
                return;
            }
        }

        if (clients.length > 0) {
            await clients[0].navigate('/mail');
            await clients[0].focus();
            return;
        }

        await self.clients.openWindow('/mail');
    })());
});

// Instant Auth State Cache
// This runs immediately (not as module) to prevent flash of unauthenticated UI
(function() {
    try {
        var cached = localStorage.getItem('cachedAuthUser');
        if (cached) {
            var data = JSON.parse(cached);
            // Cache valid for 24 hours
            if (data && data.email && (Date.now() - data.timestamp) < 86400000) {
                window.__authCached = data.email.split('@')[0];
                // Inject styles immediately to hide sign-in button
                document.write('<style>#signInBtn{display:none!important}#userMenu{display:block!important}</style>');
            }
        }
    } catch(e) {
        // localStorage might not be available, fail silently
    }
})();


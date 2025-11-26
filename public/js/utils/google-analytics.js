// Google Analytics - Carregamento dinâmico
// ID: G-8R5E7DFQ9R

(function() {
    const hostname = window.location.hostname;
    const devHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    const isDevEnvironment =
        !hostname ||
        devHosts.includes(hostname) ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.test') ||
        hostname.endsWith('.dev');

    // Evita acionar o Google Analytics em ambientes locais ou de desenvolvimento
    if (isDevEnvironment) {
        return;
    }

    // Prevenir carregamento duplicado
    if (window.googleAnalyticsLoaded) {
        return;
    }
    window.googleAnalyticsLoaded = true;

    // Inicializar dataLayer
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;

    // Configurar data inicial
    gtag('js', new Date());
    gtag('config', 'G-8R5E7DFQ9R');

    // Carregar script do Google Tag Manager
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8R5E7DFQ9R';
    document.head.appendChild(script);
})();


// Google Analytics - Carregamento dinâmico
// ID: G-8R5E7DFQ9R

(function() {
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


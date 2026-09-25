import Script from "next/script";
import type { SiteIntegrations } from "@/lib/public-api-types";

/**
 * Site Settings hub (#32) — injects a site's published integrations into the
 * rendered document. Server component, SSR-safe: every part is conditional, so a
 * site WITHOUT integrations renders nothing (no regression).
 *
 *  - GA4 (`ga4MeasurementId`)  → gtag.js loader + inline config (afterInteractive).
 *  - GTM (`gtmId`)             → GTM container loader (afterInteractive).
 *  - Live chat (`liveChatId`)  → Tawk.to widget loader (afterInteractive).
 *  - headScripts / bodyScripts → raw admin-authored HTML (trusted) injected
 *    verbatim. headScripts render here (inside the page wrapper, early); the
 *    caller renders <BodyIntegrationScripts> at end-of-body.
 *
 * Raw scripts are authored by site_admins via the Settings hub — trusted input,
 * length-capped server-side. We inject them with dangerouslySetInnerHTML so full
 * markup (style/link/script tags) works as authored.
 */
export function SiteIntegrationScripts({ integrations }: { integrations?: SiteIntegrations }) {
  if (!integrations) return null;
  const { ga4MeasurementId, gtmId, liveChatId, headScripts } = integrations;

  return (
    <>
      {ga4MeasurementId ? (
        <>
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`}
          />
          <Script id="ga4-config" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4MeasurementId}');`}
          </Script>
        </>
      ) : null}

      {gtmId ? (
        <Script id="gtm-loader" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      ) : null}

      {liveChatId ? (
        <Script id="live-chat-loader" strategy="afterInteractive">
          {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;s1.src='https://embed.tawk.to/${liveChatId}/default';
s1.charset='UTF-8';s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);})();`}
        </Script>
      ) : null}

      {headScripts ? (
        // Admin-authored (trusted). Injected verbatim into the page head region.
        <div
          data-ob-head-scripts=""
          dangerouslySetInnerHTML={{ __html: headScripts }}
        />
      ) : null}
    </>
  );
}

/**
 * End-of-body raw scripts (Site Settings hub #32). Rendered separately so the
 * caller can place it just before the closing wrapper, mirroring a classic
 * `</body>` placement. Admin-authored, trusted, length-capped server-side.
 */
export function BodyIntegrationScripts({ integrations }: { integrations?: SiteIntegrations }) {
  if (!integrations?.bodyScripts) return null;
  return (
    <div
      data-ob-body-scripts=""
      dangerouslySetInnerHTML={{ __html: integrations.bodyScripts }}
    />
  );
}

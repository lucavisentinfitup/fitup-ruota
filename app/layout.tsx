import type { Metadata, Viewport } from "next";
import { Oswald, Poppins } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });

// Browser che non eseguono il runtime di Next.js 16 (iOS < 16.4, Chrome < 94): il gioco passa in
// automatico alla versione "lite" ES5, identica nell'aspetto. Script in ES5 così parte ovunque.
const LEGACY_REDIRECT = `(function(){try{new Function("class A{static{}};var a;a??=1")}catch(e){
var m=location.pathname.match(/^\\/(gioca\\/([^\\/?#]+)\\/?)?$/);
if(m){location.replace("/lite/"+(m[2]?encodeURIComponent(decodeURIComponent(m[2])):"")+location.search)}}})();`;

const POLYFILLS = `(function(){var A=Array.prototype,S=String.prototype;
if(!A.at)A.at=function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n]};
if(!S.at)S.at=function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this.charAt(n)};
if(!Object.hasOwn)Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k)};
if(!S.replaceAll)S.replaceAll=function(a,b){return typeof a==="string"?this.split(a).join(b):this.replace(a,b)};
if(!A.findLast)A.findLast=function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i]};
if(!A.findLastIndex)A.findLastIndex=function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1};
})();`;

export const metadata: Metadata = {
  title: "Ruota della fortuna FitUP",
  description: "Gira la ruota FitUP e sfida la fortuna.",
  icons: { icon: "/brand/icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${oswald.variable} ${poppins.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LEGACY_REDIRECT }} />
        {/* piccoli polyfill per browser non aggiornati all'ultima versione */}
        <script dangerouslySetInnerHTML={{ __html: POLYFILLS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

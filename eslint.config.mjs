// ESLint (flat config) voor Next.js 16: `next lint` bestaat niet meer, dus lint draait direct via eslint.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "out/**"] },
  {
    rules: {
      // Logo's en merkbeelden zijn statische bestanden; next/image voegt hier niets toe.
      "@next/next/no-img-element": "off"
    }
  }
];

export default config;

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the bilingual privacy policy. The footer links to the language sections via the
   * anchors `#en` and `#de`. Optional — when unset, no privacy links are rendered.
   */
  readonly APP_PRIVACY_POLICY_URL?: string
  /**
   * Optional access code. When set, the app asks for the code before rendering anything
   * (a small hurdle against accidental use — not a security mechanism).
   */
  readonly APP_ACCESS_CODE?: string
}

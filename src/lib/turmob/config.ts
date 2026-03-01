
export const TURMOB_CONFIG = {
    LOGIN_URL: "https://service1.turmob.org.tr/?ReturnUrl=https://ebirlik.turmob.org.tr/AccountManager",
    CONTRACTS_URL: "https://ebirlik.turmob.org.tr/Contracts/List",

    SELECTORS: {
        TAB_TURMOB: 'a[href="#sign-turmob"]',
        USERNAME: 'input#userName',
        PASSWORD: 'input#password',
        CAPTCHA_INPUT: 'input#guvenlik',
        CAPTCHA_IMAGE: '#sign-turmob img[src^="data:image/jpg;base64"]',
        LOGIN_BUTTON: '#sign-turmob button[type="submit"]',

        // Export Modal Selectors
        EXPORT_BTN: 'button[onclick="exporter()"]',
        EXPORT_MODAL: '#exportModal',
        PERIOD_SELECT: 'select#period',
        STATUS_SELECT: 'select#status',
        EXCEL_BTN: 'input[value="Excel"]',
    },

    TIMEOUTS: {
        PAGE_LOAD: 60000,
        ELEMENT_WAIT: 30000,
        CAPTCHA_WAIT: 300000, // 5 minutes for manual entry
        DOWNLOAD_WAIT: 60000
    },

    MAX_CAPTCHA_RETRIES: 3,

    DELAYS: {
        SHORT: 500,
        MEDIUM: 1500,
        LONG: 2500,
        PAGE_LOAD: 3000
    }
};

export interface TurmobCredentials {
    username: string;
    password: string;
}

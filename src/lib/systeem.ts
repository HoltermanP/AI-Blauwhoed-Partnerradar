// Bevoegdheid voor serverprocessen (de cron-route). Een niet-geregistreerd Symbol kan niet via een server-action-aanroep
// vanuit de browser worden meegestuurd; alleen code op de server die deze module importeert kan namens 'systeem' handelen.
export const SYSTEEM_SLEUTEL: unique symbol = Symbol("systeem");
export type SysteemSleutel = typeof SYSTEEM_SLEUTEL;

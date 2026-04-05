# Proof Run Log

## Purpose

Track actual technical proof runs against the proof plan so implementation decisions are based on observed outcomes rather than assumptions.

## Latest Status

- Session persistence and login recovery: `completed`
- Packaged search extraction: `completed`
- Safe deep verification boundary (exploratory, post-MVP): `completed`
- Recovery and resume: `completed`

## Run Entries

### 2026-03-15 - Proof Harness Started

- Added Playwright to the repo
- Added `proof:session-probe` script
- Added persistent browser-state and artifact output paths for proof runs
- Next step: execute the first Trip.com session probe and record the observed state

### 2026-03-14 - Proof 1 Session Probe (connected)

- Run id: 2026-03-14T15-17-39-068Z
- Observed state: connected (Page contains account-scoped signals that usually appear after authentication.)
- Prior persistent browser state: no
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-17-39-068Z
- Manual login attempted: no
- Notes: Superseded. This was a false positive from the initial classifier because the public landing page exposes generic `My bookings` text alongside `Sign in / Register`.

### 2026-03-14 - Proof 1 Session Probe (session_expired)

- Run id: 2026-03-14T15-18-30-176Z
- Observed state: session_expired (A persistent browser state exists, but the page still prompts for authentication.)
- Prior persistent browser state: yes
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-18-30-176Z
- Manual login attempted: no
- Notes: Superseded. This was a false positive caused by treating any persisted browser state as previously authenticated state.

### 2026-03-14 - Proof 1 Session Probe (unknown)

- Run id: 2026-03-14T15-19-26-232Z
- Observed state: unknown (Persistent browser state exists, but it has not yet been proven authenticated, so this run stays unverified.)
- Prior persistent browser state: yes
- Prior authenticated marker: no
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-19-26-232Z
- Manual login attempted: no
- Notes: This is the current baseline result. The probe can reach Trip.com, persist browser state, and produce durable artifacts, but authenticated reuse remains unproven until a headed manual-login run establishes a valid authenticated marker.

### 2026-03-14 - Proof 1 Session Probe (unknown)

- Run id: 2026-03-14T15-26-22-811Z
- Observed state: unknown (Persistent browser state exists, but it has not yet been proven authenticated, so this run stays unverified.)
- Prior persistent browser state: yes
- Prior authenticated marker: no
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-26-22-811Z
- Manual login attempted: yes
- Manual recovery wait mode: not_requested
- Notes: Superseded. This headed run still used the old manual-wait gate and did not actually pause for login or recovery.

### 2026-03-14 - Proof 1 Session Probe (connected)

- Run id: 2026-03-14T15-31-08-887Z
- Observed state: connected (Page exposes strong authenticated-account signals without showing a sign-in prompt.)
- Prior persistent browser state: yes
- Prior authenticated marker: no
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-31-08-887Z
- Manual login attempted: yes
- Manual recovery wait mode: timer
- Notes: This is the first successful manual recovery run. It established the authenticated marker used for follow-up reuse checks.

### 2026-03-14 - Proof 1 Session Probe (connected)

- Run id: 2026-03-14T15-35-11-174Z
- Observed state: connected (Page exposes strong authenticated-account signals without showing a sign-in prompt.)
- Prior persistent browser state: yes
- Prior authenticated marker: yes
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-35-11-174Z
- Manual login attempted: no
- Manual recovery wait mode: not_requested
- Notes: This follow-up run reused the authenticated browser state successfully after the manual recovery step. Forced-invalid-session detection was later proven by the recovery-resume run.

### 2026-03-14 - Proof 1 Session Probe (connected)

- Run id: 2026-03-14T15-35-11-174Z
- Observed state: connected (Page exposes strong authenticated-account signals without showing a sign-in prompt.)
- Prior persistent browser state: yes
- Prior authenticated marker: yes
- Visible Trip.com URL: https://au.trip.com/flights/
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\session-probe\2026-03-14T15-35-11-174Z
- Manual login attempted: no
- Manual recovery wait mode: not_requested
- Notes: Superseded duplicate entry. The reuse result above is the correct interpretation of this run.

### 2026-03-14 - Proof 2 Packaged Search (Melbourne to Guangzhou)

- Run id: 2026-03-14T15-46-25-696Z
- Baseline search: Melbourne -> Guangzhou (2026-03-16 to 2026-03-18)
- Outbound stage URL: https://au.trip.com/flights/showfarefirst?dcity=mel&acity=can&ddate=2026-03-17&rdate=2026-03-19&triptype=rt&class=y&lowpricesource=searchform&quantity=1&searchboxarg=t&nonstoponly=off&locale=en-AU&curr=AUD
- Outbound cards parsed: 8
- Return stage URL: https://au.trip.com/flights/ShowFareNext?pagesource=list&triptype=RT&class=Y&quantity=1&childqty=0&babyqty=0&jumptype=GoToNextJournay&dcity=mel&acity=can&ddate=2026-03-17&dcityName=Melbourne&acityName=Guangzhou&rdate=2026-03-19&currentseqno=2&criteriaToken=SGP_SGP-ALI_PIDReduce-26b48162-8b82-486f-9150-c615e69ebd9e%5EList-23f9b579-78ff-418b-b7fc-7e500c13b506&shoppingid=SGP_SGP-ALI_PIDReduce-da402964-b7c3-4f29-ae79-cfcf2c42a001%5EList-2eb6cd68-e8bd-47b9-ae9c-78c9ddea82dc&groupKey=SGP_SGP-ALI_PIDReduce-da402964-b7c3-4f29-ae79-cfcf2c42a001%5EList-2eb6cd68-e8bd-47b9-ae9c-78c9ddea82dc&airline=&locale=en-AU&curr=AUD
- Return cards parsed: 8
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\packaged-search-extraction\2026-03-14T15-46-25-696Z
- Observed Trip.com flow: round-trip packaged search is a two-step flow with outbound selection followed by return selection.
- Notes: Superseded. This first packaged-search run used the older proof output that reported requested dates instead of the resolved Trip.com search dates.

### 2026-03-14 - Proof 2 Packaged Search (Melbourne to Guangzhou)

- Run id: 2026-03-14T15-47-26-647Z
- Baseline search: Melbourne -> Guangzhou (2026-03-17 to 2026-03-19)
- Outbound stage URL: https://au.trip.com/flights/showfarefirst?dcity=mel&acity=can&ddate=2026-03-17&rdate=2026-03-19&triptype=rt&class=y&lowpricesource=searchform&quantity=1&searchboxarg=t&nonstoponly=off&locale=en-AU&curr=AUD
- Outbound cards parsed: 8
- Return stage URL: https://au.trip.com/flights/ShowFareNext?pagesource=list&triptype=RT&class=Y&quantity=1&childqty=0&babyqty=0&jumptype=GoToNextJournay&dcity=mel&acity=can&ddate=2026-03-17&dcityName=Melbourne&acityName=Guangzhou&rdate=2026-03-19&currentseqno=2&criteriaToken=SGP_SGP-ALI_PIDReduce-2e319182-92ce-4adc-8bb0-83d7bed2acba%5EList-b69e159d-03b5-42d8-a578-4b1a3c89c47f&shoppingid=SGP_SGP-ALI_PIDReduce-b6941f5d-8bc3-4711-8a18-16b677a6a947%5EList-fe69ffc6-707b-49ce-8e6b-07170c65f9f1&groupKey=SGP_SGP-ALI_PIDReduce-b6941f5d-8bc3-4711-8a18-16b677a6a947%5EList-fe69ffc6-707b-49ce-8e6b-07170c65f9f1&airline=&locale=en-AU&curr=AUD
- Return cards parsed: 8
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\packaged-search-extraction\2026-03-14T15-47-26-647Z
- Observed Trip.com flow: round-trip packaged search is a two-step flow with outbound selection followed by return selection.
- Notes: This is the current packaged-search proof result. Live extraction now captures endpoints, timings, prices, visible stopover text, and the two-stage outbound/return flow needed for later candidate combination.

### 2026-03-14 - Proof 3 Deep Verification (traveler_form)

- Run id: 2026-03-14T15-52-01-946Z
- Selected outbound candidate: China Eastern Airlines / 2h 15m in Shanghai / AU$ 954
- Selected return candidate: China Eastern Airlines / 19h 30m in Nanjing / AU$ 954
- Fare-selection total: AU$ 954
- Verification stage reached: traveler_form
- Traveler-page total: TotalAU$ 953.30
- Traveler-page URL: https://au.trip.com/flights/passenger?pagesource=list&triptype=RT&class=Y&quantity=1&childqty=0&babyqty=0&jumpTime=1773503557&dcity=mel&acity=can&ddate=2026-03-17&dcityName=Melbourne&acityName=Guangzhou&rdate=2026-03-19&remarkTokenKey=48e4e6a362ec264cbb6bae52561012a9&criteriaToken=tripType%3ART%7CcriteriaToken%3ANEWTOKEN%7CKLUv_QBYnSEACkh0D0AgbfQAEBxYhxTBBmAK0AIQHBKR8Q-8K9u2H8N-1r13WA_WXoGNi_tA_3W9F9C2NU3NBKAemXKJLDOWpjt1FBsF6ADnAO0A5TqzpLZEhVaXpKHZVL6xJL-wzLCtb_5Cby6SV_YkcQRYH11jjsnspP-L3P2oh13N-VtmlJS-MecDQ2_-QJtsG8d5r_XzvLITnVwTrdOuDKX468wo6ORn3PVj2EEaitDZ_D6bpmtHZ8V_hJrxmLrg7L7xpYDe_JPiGYD1Y_OSumb8qar3ZbKA3vyrrK-aqmqeaWqWo-ZSbt1jmj-gN8cq68OocZZfDmv-Dtd7PyC9UgQtfHXBQ4MKBhQIMiIa1UUlweAKEmRgZCM2YOBgQbK5ggiCyAUDSYKMCILIBcUJCUYm4oOJDhYkO6gQ0YcFPY6FQvc5ed3nEoEsH3Xz_gwsj9asm5B5RpcldbpSFbPkRaFMSG7Zi09p_RTJZcemwky2pQnKkCMzBbp0uBbDiUXyFy0cKXR5qTa8mDrn-4i9j1QP9QgBfR5lidRwUIxIjSRYekILH2GgbZRU6iST4G3zpBeOpQEroj0CMlsChMiJ8wqnJL8wgMlyJJ_pi3P8wjDJY0Bv7itLJs3m7Im_TGr2PUUzh3VdO9UWNil965q_mN315aDi2QV_6v_4smDjuXwjhnGVytqMGIznVVaFg8F4Peu65i9S97fti_64nOMXDib6sgH05vFv31kmVWb0x2tK4LOmLNGbw-88kn8qwPowavzoWvqp1rsiUYWoJBWIXlUaelVlqCoLESKoIJ8TpZufJ31S8IPDVMF7OxYTmAGBPBXkgTBvRH4VTwRxrIj6nNST82xEkFGIxHQ8J9gxpqcKIL4SCk-i5sV4zZ-cFCYTJmhczxK23Jp2wFZsMfmjK2X-6ibXyFTKgHB0pEBKpiUEdrSfacsQbII44VrPqfLZfCoenw4Xs1HI84M7KyiIVGooIB2MrHIdYSlDjvP3ZfNrkkE6tfLBgcKMH2QKQTlEruNxumzm8YWQH6uaAlUJvk0wTfNdyzjMZx7Tsk7pGVa6ohV6c07YGQFYqWvGp4VZoTcHxVAjbgJYnvjDbwG9ebdpHcd1n3VsW181O2VD836Do2AblA0jYMGhRG_eNQrrp2-l_bOMkrXe3GsUVrqWYAAUFmpeWdN919l0t978_KYKrTePWN9dNfDWm2_CExyzDZxgXWhDo3Aap2F9y7oO07DStVShN--Vla5yhd78Aylc2NZ1zG--b1jWOd_9FWovTMNKQ_ddZ9SUXTOeB-jN-0ZWYbnvKsf_M7t_ZdEBenPSu0TQwvpsHgBRo3_iGGhoWFdhP2Jyld3NrC2Cwb1iTYxEq1fuDN5BfUtAk5tdFUaDq4E0G9fA2lmNXZgZcqMaDe7QybiEm2_VzETxkMyGJnpMRkXlNhomGQ%3D%3D%7CcabinClass%3AYSGROUP%7Cadult%3A1%7Cchild%3A0%7Cinfant%3A0%7CsubChannel%3A7%7Cchannel%3AEnglishSite%7Ccurrency%3AAUD%7CextensionFlag%3A17%7CExtensionOptions%3A%7Clist%3Atrue%7Cidc%3ASGP-ALI%7CdetailSearch%3Afalse%7Cissuer%3ACT%7CSeparateJourneyType%3A0%7CsearchScene%3A%7CairlineCodes%3A%7ClistTime%3A202603142352%7CagencyModelAgg%3Afalse%7CrichCombiner%3Atrue%7CSessionId%3A9f9aaa5a-4c7d-4bbc-8a97-6fa1502994b3%7CaggPickFlight%3AA%7CexchangeRate%3AH4sIAAAAAAAA_wGQAG__NJkUn2WTcP_JGIUIA1i33NoUsCd_TvrcjGhlHvCfDuA-pez2plxmBSxWwJGNM-dEYxPPYhBH2zE0YvVP-1IRxunfGFBcyj9gXFpWt5wSL1gisvHWiXoEvgzzrBibtIAGi__-TE9uYlPZPFQ98Ixop6Mw9SbCQzeF2cCb9N8Ic0-VSLGXYQWNsV_qQ32F7Nm3QjPQbJAAAAA%3D%7CupgradeSearch%3Afalse%7CforbidPreCoupon%3Afalse%7CabResultList%3A%5B%7B%22abCode%22%3A%22260121_IBU_DRFCOL%22%2C%22abResult%22%3A%22B%22%7D%5D%7Cdate_1%3A2026-03-17%7CaCity_1%3ACAN%7CdCity_1%3AMEL%7Cdate_2%3A2026-03-19%7CaCity_2%3AMEL%7CdCity_2%3ACAN&shoppingid=MU738-MEL-SHA-20260317%2CMU5325-SHA-CAN-20260317%2CMU9768-CAN-NKG-20260319%2CMU851-NKG-MEL-20260320%5E%5ENEWTOKEN%7CKLUv_QBYnSEACkh0D0AgbfQAEBxYhxTBBmAK0AIQHBKR8Q-8K9u2H8N-1r13WA_WXoGNi_tA_3W9F9C2NU3NBKAemXKJLDOWpjt1FBsF6ADnAO0A5TqzpLZEhVaXpKHZVL6xJL-wzLCtb_5Cby6SV_YkcQRYH11jjsnspP-L3P2oh13N-VtmlJS-MecDQ2_-QJtsG8d5r_XzvLITnVwTrdOuDKX468wo6ORn3PVj2EEaitDZ_D6bpmtHZ8V_hJrxmLrg7L7xpYDe_JPiGYD1Y_OSumb8qar3ZbKA3vyrrK-aqmqeaWqWo-ZSbt1jmj-gN8cq68OocZZfDmv-Dtd7PyC9UgQtfHXBQ4MKBhQIMiIa1UUlweAKEmRgZCM2YOBgQbK5ggiCyAUDSYKMCILIBcUJCUYm4oOJDhYkO6gQ0YcFPY6FQvc5ed3nEoEsH3Xz_gwsj9asm5B5RpcldbpSFbPkRaFMSG7Zi09p_RTJZcemwky2pQnKkCMzBbp0uBbDiUXyFy0cKXR5qTa8mDrn-4i9j1QP9QgBfR5lidRwUIxIjSRYekILH2GgbZRU6iST4G3zpBeOpQEroj0CMlsChMiJ8wqnJL8wgMlyJJ_pi3P8wjDJY0Bv7itLJs3m7Im_TGr2PUUzh3VdO9UWNil965q_mN315aDi2QV_6v_4smDjuXwjhnGVytqMGIznVVaFg8F4Peu65i9S97fti_64nOMXDib6sgH05vFv31kmVWb0x2tK4LOmLNGbw-88kn8qwPowavzoWvqp1rsiUYWoJBWIXlUaelVlqCoLESKoIJ8TpZufJ31S8IPDVMF7OxYTmAGBPBXkgTBvRH4VTwRxrIj6nNST82xEkFGIxHQ8J9gxpqcKIL4SCk-i5sV4zZ-cFCYTJmhczxK23Jp2wFZsMfmjK2X-6ibXyFTKgHB0pEBKpiUEdrSfacsQbII44VrPqfLZfCoenw4Xs1HI84M7KyiIVGooIB2MrHIdYSlDjvP3ZfNrkkE6tfLBgcKMH2QKQTlEruNxumzm8YWQH6uaAlUJvk0wTfNdyzjMZx7Tsk7pGVa6ohV6c07YGQFYqWvGp4VZoTcHxVAjbgJYnvjDbwG9ebdpHcd1n3VsW181O2VD836Do2AblA0jYMGhRG_eNQrrp2-l_bOMkrXe3GsUVrqWYAAUFmpeWdN919l0t978_KYKrTePWN9dNfDWm2_CExyzDZxgXWhDo3Aap2F9y7oO07DStVShN--Vla5yhd78Aylc2NZ1zG--b1jWOd_9FWovTMNKQ_ddZ9SUXTOeB-jN-0ZWYbnvKsf_M7t_ZdEBenPSu0TQwvpsHgBRo3_iGGhoWFdhP2Jyld3NrC2Cwb1iTYxEq1fuDN5BfUtAk5tdFUaDq4E0G9fA2lmNXZgZcqMaDe7QybiEm2_VzETxkMyGJnpMRkXlNhomGQ%3D%3D%5E8000000000K6B06H02ubJH6GC5D5803zH2gQFwZZC28w0VgEDJwn0Kp5IE137MG48004nGgQNwZa00X00VgETnRp4T0lK7BEE1321MW0QcgQNw0vPmj00VgEb80_KTLWLC5D000000000010Ozqe82000044000ARC0000N00002xWYA00RLHLJGXL380000000000%7C%7C%7CIVBU6TSPJVMSAU2UIFHEIQKSIQXUKQ2PJZHU2WJAKNKECTSEIFJEIL2FINHU4T2NLEQFGVCBJZCECUSEF5CUGT2OJ5GVSICTKRAU4RCBKJCA%3D%3D%3D%3D%7C%7C%7C%7CCgoxU200UHhQeUJz%7CGAIgCSjb6JjeBkgB%5E%5E953.3%5E%5Emore_grade_false%5EMU738-1-1-20260317-20260317-MEL-PVG-Y-MEL-SHA-T2-T1-789-MU-20260317120000-20260317190000%2CMU5325-1-2-20260317-20260318-PVG-CAN-Y-SHA-CAN-T1-T3-32N-MU-20260317211500-20260318001000%2CMU9768-2-1-20260319-20260320-CAN-NKG-Y-CAN-NKG-T3-T2-32N-MU-20260319230500-20260320013000%2CMU851-2-2-20260320-20260321-NKG-MEL-Y-NKG-MEL-T2-T2-33J-MU-20260320210000-20260321110000%5E%5E%5E%5E%5E%5E%5E%5E%5EXP_H4sIAAAAAAAA_1OXyhPdbJvBs2Km3gPpl9qKADJlTAIQAAAA%5E%5Eno_full_recommend%5E%5ECaaJointFlightFlag_InterlineFlight%5E%5E938.30%5E%5E%5EPolicyIdVersion_1%5E%5E%5E%5E%5E15.00%5E%5E%5EFreeXProductList_H4sIAAAAAAAA%2F4uOBQApu0wNAgAAAA%3D%3D%5EMINPRICE%5E%5E%5E%5E%5E%5E%5EqinDelim8000000000K6B06H02ubJH6GC5D5803zH2gQFwZZC28w0VgEDJwn0Kp5IE137MG48004nGgQNwZa00X00VgETnRp4T0lK7BEE1321MW0QcgQNw0vPmj00VgEb80_KTLWLC5D000000000010Ozqe82000044000ARC0000N00002xWYA00RLHLJGXL380000000000%7C%7C%7CIVBU6TSPJVMSAU2UIFHEIQKSIQXUKQ2PJZHU2WJAKNKECTSEIFJEIL2FINHU4T2NLEQFGVCBJZCECUSEF5CUGT2OJ5GVSICTKRAU4RCBKJCA%3D%3D%3D%3D%7C%7C%7C%7CCgoxU200UHhQeUJz%7CGAIgCSjb6JjeBkgBqinDelim&midSelectPrice=953.3&shortPolicyId=SGP_SGP-ALI_PIDReduce-NmKCkZO8%5EMiddle-BTPTr4%5EhyEAeSj8rvLd0szA%5EMEL%2CCAN%2C2026-03-17%7CCAN%2CMEL%2C2026-03-19%3B3%3B1%2C1%2C1%2CMU738%2C3%2C1773712800000%7C1%2C2%2C1%2CMU5325%2C3%2C1773753300000%7C2%2C1%2C1%2CMU9768%2C3%2C1773932700000%7C2%2C2%2C1%2CMU851%2C3%2C1774011600000&locale=en-AU&curr=AUD&txid=1-mf-20260315025210751-WEB
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\deep-verification-boundary\2026-03-14T15-52-01-946Z
- Notes: the proof stops on the traveler-details page before any passenger data submission or payment action.

### 2026-03-14 - Proof 4 Recovery Resume (session_expired -> connected)

- Run id: 2026-03-14T15-57-11-853Z
- Checkpoint stage: outbound_results
- Checkpoint candidate: China Eastern Airlines / 2h 15m in Shanghai / AU$ 954
- Blocked state observed: session_expired (The previously authenticated browser context now prompts for authentication.)
- Resume mode: partial_restart
- Manual recovery wait mode: timer
- Post-recovery state: connected (Page exposes strong authenticated-account signals without showing a sign-in prompt.)
- Matched checkpoint candidate after resume: yes
- Artifact directory: C:\Users\j7636\AppData\Roaming\FlyEasy\artifacts\proofs\recovery-resume\2026-03-14T15-57-11-853Z
- Notes: the proof preserves partial results, blocks on forced session invalidation, and resumes through an explicit partial restart in the same browser context.

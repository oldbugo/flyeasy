# Trip Settings Baggage And Chinese-Airline Filters

Status: `Complete`

## Goal

Add two session-level trip-setting constraints that change the live search
worker itself, not just the UI:

- only keep flights that explicitly include checked baggage
- only keep flights marketed or operated by mainland China carriers

## What changed

- Added persistent session booleans for:
  - `requireIncludedCheckedBaggage`
  - `restrictToChineseAirlines`
- Added the controls to `Trip settings`
- Extended Trip.com card parsing so the worker reads:
  - included checked-baggage labels
  - airline logo carrier codes when available
  - operating-airline text such as `operated by Shenzhen Airlines`
- Added deterministic worker-side filtering so the constraints apply across:
  - direct sweep
  - return-option expansion
  - stopover follow-up
  - anchored true multi-city search

## Chinese-airline definition

The current definition is explicit and deterministic rather than fuzzy.

FlyEasy treats a card as `Chinese-based airline only` when the marketed airline
or the operating airline matches FlyEasy's mainland China carrier list, using
carrier code and known airline names where available.

This includes major mainland carriers such as:

- Air China
- China Eastern Airlines
- China Southern Airlines
- XiamenAir
- Hainan Airlines
- Shenzhen Airlines
- Sichuan Airlines
- Juneyao Air
- Spring Airlines
- Shandong Airlines
- Shanghai Airlines
- and related mainland affiliates already encoded in the worker list

## Why this matters

These are hard search constraints.

Without worker-side enforcement, FlyEasy would still spend search budget on
cards the user never wants, and later strategy outputs would be built on the
wrong foundation.

## Remaining limits

- The baggage rule depends on Trip.com showing an included checked-baggage label
  on the visible card.
- The airline rule is only as good as the explicit mainland-carrier list and
  Trip.com's displayed marketed/operating airline text.
- Existing runs will not backfill these flags. A fresh run is required to see
  the constraint effect in live results.

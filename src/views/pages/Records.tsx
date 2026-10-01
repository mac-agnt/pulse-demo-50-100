import { Fragment } from "react";
import { arr, cx, txt } from "../../runtime/template";

type Props = { v: any };

export default function Records({ v }: Props) {
  return (
    <>
      <div style={{"padding":"0 22px 26px","animation":"pageIn .7s var(--ease) both"}}>
        {v.rec?.hasHero && (
          <>
            <div style={{"position":"relative"}} />
            <div style={{"position":"relative","display":"flex","flexDirection":"column","alignItems":"center","textAlign":"center","padding":"64px 0 52px"}}>
              <button className={cx("ix12", "ixo")} onClick={v.rec?.openNew} title="New record" style={{"position":"absolute","right":"0","top":"20px","width":"40px","height":"40px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,14px)","background":"var(--surface)","color":"var(--ink)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","backdropFilter":"blur(24px)","transition":"background .2s var(--ease),transform .2s var(--ease),border-color .2s var(--ease)"}}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                  <path d="M12 5v14 M5 12h14" />
                </svg>
              </button>
              <span style={{"display":"inline-flex","alignItems":"center","gap":"8px","height":"28px","padding":"0 14px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-sm,10px)","backdropFilter":"blur(24px)","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--dim)"}}>
                <span style={{"width":"5px","height":"5px","borderRadius":"2px","background":"var(--accent)"}} />
                {txt(v.rec?.eyebrow)}
              </span>
              <h1 style={{"margin":"22px 0 0","fontSize":"clamp(38px,4.4vw,58px)","fontWeight":"500","letterSpacing":"-1px","lineHeight":"1.02"}}>
                {txt(v.rec?.title)}
              </h1>
              <p style={{"margin":"14px 0 0","maxWidth":"520px","fontSize":"15px","lineHeight":"1.6","color":"var(--dim)","textWrap":"pretty"}}>
                {txt(v.rec?.blurb)}
              </p>
              <div style={{"width":"min(680px,100%)","marginTop":"30px"}}>
                <div className="ixz" style={{"display":"flex","alignItems":"center","gap":"12px","padding":"13px 15px 13px 19px","background":"var(--hero-field)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","boxShadow":"0 18px 44px rgba(0,0,0,.28)","backdropFilter":"blur(20px) saturate(1.4)","transition":"border-color .24s var(--ease),box-shadow .3s var(--ease)"}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" style={{"flex":"none"}}>
                    <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
                  </svg>
                  <input value={v.rec?.ask ?? ""} onChange={v.rec?.setAsk} placeholder={v.rec?.askPlaceholder} style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"16px"}} />
                  {v.rec?.asking && (
                    <>
                      <button className="ixm" onClick={v.rec?.clearAsk} style={{"flex":"none","width":"28px","height":"28px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M6 6l12 12 M18 6 6 18" />
                        </svg>
                      </button>
                    </>
                  )}
                  <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--faint)","whiteSpace":"nowrap"}}>
                    {txt(v.rec?.searchKind)}
                  </span>
                </div>
                <div style={{"display":"flex","flexWrap":"wrap","justifyContent":"center","gap":"7px","marginTop":"14px","minHeight":"30px"}}>
                  {v.rec?.asking && (
                    <>
                      <span style={{"fontSize":"12.5px","color":"var(--dim)"}}>
                        {txt(v.rec?.askAnswer)}
                      </span>
                    </>
                  )}
                  {v.rec?.notAsking && (
                    <>
                      {arr(v.rec?.askSuggestions).map((s: any, i48: number) => (
                        <Fragment key={i48}>
                          <button className="ixe" onClick={s?.use} style={{"height":"30px","padding":"0 13px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-ctl,9px)","fontSize":"12px","color":"var(--dim)","cursor":"pointer","backdropFilter":"blur(20px)","transition":"border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease)"}}>
                            {txt(s?.label)}
                          </button>
                        </Fragment>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div style={{"display":"flex","alignItems":"center","gap":"8px","marginTop":"38px","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.16em","color":"var(--faint)"}}>
                {"\n"}
                {txt(v.rec?.scrollHint)}
                {"\n"}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14 M5.5 12.5 12 19l6.5-6.5" />
                </svg>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

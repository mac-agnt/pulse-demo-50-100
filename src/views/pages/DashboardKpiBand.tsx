import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";
import KpiBackdrop from "./KpiBackdrop";

type Props = { v: any };

export default function DashboardKpiBand({ v }: Props) {
  return (
    <>
      <div data-kpi-band="1" style={css(cat("position:relative;z-index:3;flex:none;width:100%;max-width:1280px;margin:0 auto;padding:40px 50px 34px;box-sizing:border-box;background:none;--kb:", v.kpiBackdrop))}>
        {v.kpiBackdropOn && <KpiBackdrop v={v} />}
        <div style={{"position":"relative","display":"flex","alignItems":"center","gap":"12px","paddingBottom":"12px"}}>
          <div style={{"flex":"1","minWidth":"0"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--on-accent-2)"}}>
              {"CORE KPIS · ALWAYS IN VIEW"}
            </div>
            <div style={{"fontSize":"30px","fontWeight":"600","letterSpacing":"-.9px","marginTop":"8px","color":"var(--ink)"}}>
              {txt(v.dashTitle)}
            </div>
          </div>
          <button className="ixb" onClick={v.toggleKpiEdit} style={css(cat("height:32px;display:flex;align-items:center;gap:7px;padding:0 13px;background:", v.kpiEditBg, ";border:1px solid ", v.kpiEditBorder, ";border-radius:var(--r-ctl,9px);font-size:12.5px;color:", v.kpiEditColor, ";cursor:pointer;transition:background .2s var(--ease),border-color .2s var(--ease),transform .18s var(--ease)"))}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6V20Z" />
            </svg>
            {txt(v.kpiEditLabel)}
          </button>
        </div>
        <div style={{"position":"relative","display":"flex","flexWrap":"wrap","gap":"16px","marginTop":"10px"}}>
          {arr(v.kpis).map((k: any, i4: number) => (
            <Fragment key={i4}>
              <div className="ixc" style={{"position":"relative","flex":"1 1 180px","minWidth":"0","padding":"22px 22px 20px","background":"linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.015) 55%)","border":"1px solid rgba(255,255,255,.1)","borderRadius":"24px","color":"var(--ink)","backdropFilter":"blur(22px) saturate(1.5)","WebkitBackdropFilter":"blur(22px) saturate(1.5)","boxShadow":"inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.22)","transition":"transform .3s var(--ease),border-color .25s var(--ease),background .25s var(--ease)"}}>
                <div style={{"display":"flex","alignItems":"flex-start","gap":"10px"}}>
                  <div style={{"flex":"1","minWidth":"0","fontSize":"10.5px","fontWeight":"500","letterSpacing":".14em","textTransform":"uppercase","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap","paddingTop":"4px"}}>
                    {txt(k?.label)}
                  </div>
                </div>
                <div style={css(k?.valueStyle)}>
                  {txt(k?.value)}
                </div>
                <div style={{"display":"flex","alignItems":"center","gap":"6px","marginTop":"7px"}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={k?.deltaColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={css(k?.arrowStyle)}>
                    <path d={k?.arrow} />
                  </svg>
                  <span style={css(cat("font-size:11.5px;white-space:nowrap;color:", k?.deltaColor))}>
                    {txt(k?.delta)}
                  </span>
                  <span style={{"fontSize":"10.5px","opacity":".78","minWidth":"0","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(k?.hint)}
                  </span>
                </div>
                {v.kpiEdit && (
                  <>
                    <button className="ixd" onClick={k?.remove} title="Remove KPI" style={{"position":"absolute","top":"9px","right":"9px","width":"22px","height":"22px","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </Fragment>
          ))}
        </div>
        {v.kpiEdit && (
          <>
            <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"7px","marginTop":"10px","animation":"expandIn .26s var(--ease) both"}}>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)","marginRight":"2px"}}>
                {"ADD KPI"}
              </span>
              {arr(v.kpiChoices).map((c: any, i5: number) => (
                <Fragment key={i5}>
                  <button className="ixe" onClick={c?.add} style={{"height":"29px","display":"flex","alignItems":"center","gap":"7px","padding":"0 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                    <span style={{"color":"var(--accent)"}}>
                      {"+"}
                    </span>
                    {txt(c?.label)}
                  </button>
                </Fragment>
              ))}
              {v.noKpiChoices && (
                <>
                  <span style={{"fontSize":"12px","color":"var(--faint)"}}>
                    {"Every KPI is pinned."}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

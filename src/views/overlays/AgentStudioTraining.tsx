import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";

type Props = { v: any };

export default function AgentStudioTraining({ v }: Props) {
  return (
    <>
      <div style={css(cat("margin-top:22px;padding:18px 20px;background:", v.trainBg, ";border:1px solid ", v.trainBorder, ";border-radius:var(--card-r,18px);transition:background .3s var(--ease),border-color .3s var(--ease)"))}>
        <div style={{"display":"flex","alignItems":"center","gap":"16px","flexWrap":"wrap"}}>
          <div style={{"position":"relative","flex":"none","width":"76px","height":"76px"}}>
            {v.trainBusy && (
              <>
                <span style={{"position":"absolute","left":"50%","top":"50%","width":"104px","height":"104px","transform":"translate(-50%,-50%)","borderRadius":"var(--r-md,14px)","background":"radial-gradient(closest-side,var(--accent-soft),transparent 72%)","animation":"trainHalo 2.2s ease-in-out infinite"}} />
                <span style={{"position":"absolute","inset":"-6px","borderRadius":"var(--card-r,18px)","border":"1px solid var(--accent-line)","borderTopColor":"var(--accent)","animation":"trainSpin 1.15s linear infinite"}} />
              </>
            )}
            <svg width="76" height="76" viewBox="0 0 76 76" style={{"position":"absolute","inset":"0"}}>
              <rect x="8" y="8" width="60" height="60" rx="16" fill="none" stroke="var(--border)" strokeWidth="3" />
              <rect x="8" y="8" width="60" height="60" rx="16" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="145" style={css(v.trainDashStyle)} />
            </svg>
            <span style={{"position":"absolute","inset":"0","display":"flex","alignItems":"center","justifyContent":"center"}}>
              <AgentFace shape={v.draftAgent?.shape} state={v.draftAgent?.state} tint={v.draftAgent?.tint} size={"40"} />
            </span>
          </div>
          <div style={{"flex":"1","minWidth":"200px"}}>
            <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
              <span style={{"fontSize":"13.5px","fontWeight":"500"}}>
                {txt(v.trainTitle)}
              </span>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--accent)"}}>
                {txt(v.trainPhaseLabel)}
              </span>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                {txt(v.trainPct)}
              </span>
            </div>
            <div style={{"fontSize":"12.5px","color":"var(--dim)","lineHeight":"1.55","marginTop":"5px"}}>
              {txt(v.trainBody)}
            </div>
          </div>
          {v.trainIdle && (
            <>
              <button className={cx("ixp", "ixq")} onClick={v.train} style={{"flex":"none","height":"36px","padding":"0 18px","border":"0","borderRadius":"var(--cta-r,13px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                {txt(v.trainLabel)}
              </button>
            </>
          )}
          {v.trainBusy && (
            <>
              <span style={{"flex":"none","display":"flex","alignItems":"center","gap":"7px","height":"36px","padding":"0 16px","border":"1px solid var(--accent-line)","borderRadius":"var(--r-md,13px)","fontFamily":"var(--mono)","fontSize":"10px","letterSpacing":"0.12em","color":"var(--accent)"}}>
                <span style={{"width":"5px","height":"5px","borderRadius":"2px","background":"var(--accent)","animation":"breathe 1s ease-in-out infinite"}} />
                {"TRAINING"}
              </span>
            </>
          )}
        </div>
        {v.trainSteps && (
          <>
            <div style={{"display":"flex","flexDirection":"column","gap":"9px","marginTop":"16px"}}>
              {arr(v.trainLog).map((s: any, i140: number) => (
                <Fragment key={i140}>
                  <div style={css(s?.rowStyle)}>
                    <span style={css(cat("width:6px;height:6px;flex:none;border-radius:2px;background:", s?.dot))} />
                    <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--body)"}}>
                      {txt(s?.text)}
                    </span>
                    <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                      {txt(s?.meta)}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

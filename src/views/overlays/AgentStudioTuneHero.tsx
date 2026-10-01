import { Fragment } from "react";
import { arr, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";

type Props = { v: any };

export default function AgentStudioTuneHero({ v }: Props) {
  return (
    <>
      <div style={{"position":"relative","padding":"22px 18px 16px","background":"linear-gradient(168deg,var(--accent-faint) 0%,var(--surface) 42%,var(--surface-faint) 100%)","border":"1px solid var(--accent-line)","borderRadius":"var(--card-r,18px)","overflow":"hidden"}}>
        <span style={{"position":"absolute","right":"0","top":"0","width":"56%","height":"74%","pointerEvents":"none","opacity":".5","backgroundImage":"radial-gradient(var(--accent) .8px, transparent .8px)","backgroundSize":"9px 9px","maskImage":"linear-gradient(215deg,#000,transparent 68%)","WebkitMaskImage":"linear-gradient(215deg,#000,transparent 68%)"}} />
        <span style={{"position":"absolute","left":"50%","top":"-40%","width":"78%","height":"130%","transform":"translateX(-50%)","pointerEvents":"none","filter":"blur(46px)","opacity":".55","background":"radial-gradient(closest-side,var(--accent-soft),transparent 72%)"}} />
        <button className="ixy" onClick={v.retrain} title="Retrain from the ontology" style={{"position":"absolute","right":"14px","top":"14px","zIndex":"2","display":"flex","alignItems":"center","gap":"6px","height":"26px","padding":"0 11px","border":"1px solid var(--accent-line)","borderRadius":"var(--r-ctl,9px)","background":"var(--surface-strong)","backdropFilter":"blur(14px)","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--accent)","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 1 0-2.3 5.7 M20 5v6h-6" />
          </svg>
          {"RETRAIN"}
        </button>
        <div style={{"position":"relative","display":"flex","alignItems":"center","justifyContent":"center","gap":"0"}}>
          <span style={{"flex":"none","width":"62px","height":"62px","borderRadius":"var(--card-r,18px)","background":"var(--surface-strong)","border":"1px solid var(--border)","display":"flex","alignItems":"center","justifyContent":"center","boxShadow":"0 8px 22px rgba(0,0,0,.4)"}}>
            <AgentFace shape={v.draftAgent?.shape} state={v.draftAgent?.state} tint={v.draftAgent?.tint} size={"40"} />
          </span>
          <span style={{"position":"relative","flex":"none","width":"78px","height":"3px","borderRadius":"2px","background":"var(--accent-line)"}}>
            <span style={{"position":"absolute","left":"-6px","right":"-6px","top":"-9px","bottom":"-9px","borderRadius":"var(--r-sm,9px)","filter":"blur(9px)","background":"var(--accent)","opacity":".4"}} />
            <span style={{"position":"absolute","inset":"0","borderRadius":"var(--r-sm,9px)","overflow":"hidden"}}>
              <span style={{"position":"absolute","inset":"0","background":"linear-gradient(90deg,transparent,var(--accent),transparent)","animation":"syncFlow 1.9s linear infinite"}} />
            </span>
          </span>
          <span style={{"flex":"none","width":"62px","height":"62px","borderRadius":"var(--card-r,18px)","background":"var(--surface-strong)","border":"1px solid var(--border)","display":"flex","alignItems":"center","justifyContent":"center","boxShadow":"0 8px 22px rgba(0,0,0,.4)"}}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{"overflow":"visible"}}>
              <circle cx="20" cy="20" r="14" stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="2 4" opacity=".8" />
              <line x1="20" y1="20" x2="20" y2="6.5" stroke="var(--accent-line)" strokeWidth="1" />
              <line x1="20" y1="20" x2="32" y2="14" stroke="var(--accent-line)" strokeWidth="1" />
              <line x1="20" y1="20" x2="30" y2="29" stroke="var(--accent-line)" strokeWidth="1" />
              <line x1="20" y1="20" x2="10" y2="29" stroke="var(--accent-line)" strokeWidth="1" />
              <line x1="20" y1="20" x2="8" y2="14" stroke="var(--accent-line)" strokeWidth="1" />
              <line x1="20" y1="6.5" x2="32" y2="14" stroke="var(--accent-line)" strokeWidth=".7" opacity=".5" />
              <line x1="10" y1="29" x2="30" y2="29" stroke="var(--accent-line)" strokeWidth=".7" opacity=".5" />
              <circle cx="20" cy="20" r="5" fill="var(--accent)" style={{"filter":"drop-shadow(0 0 6px var(--accent))"}} />
              <circle cx="20" cy="20" r="2" fill="var(--on-accent)" opacity=".55" />
              <circle cx="20" cy="6.5" r="2.6" fill="var(--accent)" opacity=".9" />
              <circle cx="32" cy="14" r="2.2" fill="var(--accent)" opacity=".7" />
              <circle cx="30" cy="29" r="2.4" fill="var(--accent)" opacity=".8" />
              <circle cx="10" cy="29" r="2" fill="var(--accent)" opacity=".6" />
              <circle cx="8" cy="14" r="2.4" fill="var(--accent)" opacity=".75" />
            </svg>
          </span>
        </div>
        <div style={{"position":"relative","textAlign":"center","marginTop":"14px"}}>
          <div style={{"fontSize":"15px","fontWeight":"500","letterSpacing":"-.3px"}}>
            {txt(v.draftAgent?.name)}
            {" + the ontology"}
          </div>
          <div style={{"display":"flex","alignItems":"center","justifyContent":"center","gap":"7px","marginTop":"6px"}}>
            <span style={{"width":"5px","height":"5px","borderRadius":"2px","background":"var(--accent)","boxShadow":"0 0 8px var(--accent)","animation":"breathe 2.4s ease-in-out infinite"}} />
            <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--accent)"}}>
              {"FULLY SYNCED"}
            </span>
          </div>
        </div>
        <div style={{"position":"relative","display":"grid","gridTemplateColumns":"repeat(3,1fr)","gap":"8px","marginTop":"14px"}}>
          {arr(v.syncStats).map((t: any, i132: number) => (
            <Fragment key={i132}>
              <div style={{"padding":"9px 11px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,9px)","textAlign":"center"}}>
                <div style={{"fontFamily":"var(--mono)","fontSize":"14px","color":"var(--ink)"}}>
                  {txt(t?.value)}
                </div>
                <div style={{"fontFamily":"var(--mono)","fontSize":"8.5px","letterSpacing":"0.12em","color":"var(--faint)","marginTop":"3px"}}>
                  {txt(t?.label)}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

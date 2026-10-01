import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";
import AgentStudioTuneHero from "./AgentStudioTuneHero";
import AgentStudioNewHero from "./AgentStudioNewHero";
import AgentStudioPrompt from "./AgentStudioPrompt";
import AgentStudioTraining from "./AgentStudioTraining";

type Props = { v: any };

export default function AgentStudio({ v }: Props) {
  return (
    <>
      <div onClick={v.closeBuilder} style={{"position":"fixed","inset":"0","zIndex":"70","background":"var(--scrim)","backdropFilter":"blur(6px)","display":"flex","alignItems":"flex-start","justifyContent":"center","padding":"7vh 16px 4vh","overflowY":"auto"}}>
        <div onClick={v.stop} style={{"width":"min(720px,100%)","display":"flex","flexDirection":"column","background":"var(--overlay)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","boxShadow":"0 30px 80px rgba(0,0,0,.55)","backdropFilter":"blur(20px)","overflow":"hidden","animation":"riseIn .32s var(--ease) both"}}>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"14px","padding":"20px 24px","borderBottom":"1px solid var(--border)"}}>
            <AgentFace shape={v.draftAgent?.shape} state={v.draftAgent?.state} tint={v.draftAgent?.tint} size={"46"} />
            <div style={{"flex":"1","minWidth":"0"}}>
              <input value={v.draftAgent?.name ?? ""} onChange={v.setAgentName} placeholder="Name this agent" style={{"width":"100%","border":"0","outline":"0","background":"none","fontSize":"20px","fontWeight":"500","letterSpacing":"-.5px"}} />
              <div style={{"fontFamily":"var(--mono)","fontSize":"10px","letterSpacing":"0.1em","color":"var(--faint)","marginTop":"3px"}}>
                {txt(v.builderHint)}
              </div>
            </div>
            <button className="ixm" onClick={v.closeBuilder} style={{"width":"30px","height":"30px","flex":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12 M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div style={{"flex":"1","minHeight":"0","padding":"20px 24px 4px"}}>
            {v.isTune && <AgentStudioTuneHero v={v} />}
            <div style={css(cat("display:flex;align-items:baseline;gap:10px;", v.faceTopStyle))}>
              <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                {"FACE"}
              </span>
              <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                {txt(v.draftAgent?.shapeLabel)}
              </span>
            </div>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(6,1fr)","gap":"7px","marginTop":"10px"}}>
              {arr(v.faceChoices).map((c: any, i133: number) => (
                <Fragment key={i133}>
                  <button onClick={c?.pick} title={c?.label} style={css(c?.style)}>
                    <AgentFace shape={c?.shape} state={c?.state} tint={c?.tint} size={"34"} />
                  </button>
                </Fragment>
              ))}
            </div>
            <div style={{"display":"flex","alignItems":"baseline","gap":"10px","marginTop":"22px"}}>
              <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                {"SHELL COLOUR"}
              </span>
              <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                {"Status light stays the state's"}
              </span>
            </div>
            <div style={{"display":"flex","flexWrap":"wrap","gap":"8px","marginTop":"10px"}}>
              {arr(v.tintChoices).map((c: any, i134: number) => (
                <Fragment key={i134}>
                  <button onClick={c?.pick} title={c?.label} style={css(c?.style)} />
                </Fragment>
              ))}
            </div>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)","marginTop":"22px"}}>
              {"PERSONALITY"}
            </div>
            <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","marginTop":"10px"}}>
              {arr(v.personalities).map((p: any, i135: number) => (
                <Fragment key={i135}>
                  <button onClick={p?.pick} style={css(p?.style)}>
                    {txt(p?.label)}
                  </button>
                </Fragment>
              ))}
            </div>
            <textarea className="ix13" value={v.draftAgent?.persona ?? ""} onChange={v.setPersona} rows={2} placeholder="Describe how it should carry itself" style={{"width":"100%","marginTop":"10px","padding":"12px 14px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","outline":"0","resize":"none","fontSize":"13px","lineHeight":"1.55","transition":"border-color .22s var(--ease)"}} />
            {v.isNewAgent && <AgentStudioNewHero v={v} />}
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)","marginTop":"22px"}}>
              {"HOW IT ANSWERS"}
            </div>
            <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","marginTop":"10px"}}>
              {arr(v.answerStyles).map((a: any, i139: number) => (
                <Fragment key={i139}>
                  <button onClick={a?.pick} style={css(a?.style)}>
                    {txt(a?.label)}
                  </button>
                </Fragment>
              ))}
            </div>
            {v.isTune && <AgentStudioPrompt v={v} />}
            {v.isNewAgent && <AgentStudioTraining v={v} />}
          </div>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"18px 24px","borderTop":"1px solid var(--border)"}}>
            <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {txt(v.builderFooter)}
            </span>
            <button className="ixz" onClick={v.closeBuilder} style={{"height":"36px","padding":"0 16px","background":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--ink)","cursor":"pointer","transition":"border-color .2s var(--ease)"}}>
              {"Cancel"}
            </button>
            <button className={cx("ixp", "ixq")} onClick={v.saveAgent} style={{"height":"36px","padding":"0 18px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
              {txt(v.saveLabel)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

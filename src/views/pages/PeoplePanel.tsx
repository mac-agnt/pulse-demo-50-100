import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";
import PeopleAddPanel from "./PeopleAddPanel";

type Props = { v: any };

export default function PeoplePanel({ v }: Props) {
  return (
    <>
      <div style={{"display":"grid","gridTemplateColumns":"repeat(3,1fr)","gap":"10px"}}>
        <div style={{"padding":"13px 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-sm,9px)"}}>
          <div style={{"fontSize":"10.5px","color":"var(--faint)"}}>
            {"TOTAL ACCOUNTS"}
          </div>
          <div style={{"fontFamily":"var(--mono)","fontSize":"20px","fontWeight":"var(--fig-weight,inherit)","marginTop":"5px"}}>
            {txt(v.admin?.panel?.people?.total)}
          </div>
        </div>
        <div style={{"padding":"13px 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-sm,9px)"}}>
          <div style={{"fontSize":"10.5px","color":"var(--faint)"}}>
            {"ACTIVE"}
          </div>
          <div style={{"fontFamily":"var(--mono)","fontSize":"20px","fontWeight":"var(--fig-weight,inherit)","marginTop":"5px","color":"var(--ok)"}}>
            {txt(v.admin?.panel?.people?.active)}
          </div>
        </div>
        <div style={{"padding":"13px 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-sm,9px)"}}>
          <div style={{"fontSize":"10.5px","color":"var(--faint)"}}>
            {"SUSPENDED"}
          </div>
          <div style={{"fontFamily":"var(--mono)","fontSize":"20px","fontWeight":"var(--fig-weight,inherit)","marginTop":"5px"}}>
            {txt(v.admin?.panel?.people?.suspended)}
          </div>
        </div>
      </div>
      <button className="ixw" onClick={v.admin?.panel?.people?.toggleAdd} style={{"width":"100%","height":"38px","marginTop":"16px","display":"flex","alignItems":"center","justifyContent":"center","gap":"8px","border":"1px dashed var(--border-strong)","borderRadius":"var(--r-ctl,13px)","background":"none","color":"var(--dim)","fontSize":"13px","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14 M5 12h14" />
        </svg>
        {"Add account"}
      </button>
      {v.admin?.panel?.people?.addOpen && <PeopleAddPanel v={v} />}
      <div style={{"marginTop":"18px"}}>
        {arr(v.admin?.panel?.people?.rows).map((p: any, i82: number) => (
          <Fragment key={i82}>
            <div style={{"padding":"13px 0","borderTop":"1px solid var(--border)"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
                <span style={{"width":"32px","height":"32px","flex":"none","borderRadius":"var(--r-sm,11px)","background":"var(--surface-2)","border":"1px solid var(--border)","display":"flex","alignItems":"center","justifyContent":"center","fontSize":"11.5px","fontWeight":"600","color":"var(--dim)"}}>
                  {txt(p?.initials)}
                </span>
                <div style={{"flex":"1","minWidth":"0"}}>
                  <div style={{"fontSize":"13.5px","fontWeight":"500","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(p?.name)}
                  </div>
                  <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"2px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(p?.jobTitle)}
                    {" · "}
                    {txt(p?.email)}
                  </div>
                </div>
                <span style={css(p?.statusStyle)}>
                  {txt(p?.statusLabel)}
                </span>
                <button onClick={p?.cycleRole} title="Click to change permission tier" style={{"height":"26px","padding":"0 11px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"11px","color":"var(--ink)","cursor":"pointer","whiteSpace":"nowrap"}}>
                  {txt(p?.role)}
                </button>
                <button onClick={p?.toggleExpand} style={{"width":"26px","height":"26px","flex":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" style={css(p?.chevronStyle)}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
              {p?.expanded && (
                <>
                  <div style={{"marginTop":"12px","padding":"12px 14px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-md,12px)","animation":"expandIn .22s var(--ease) both"}}>
                    <div style={{"fontSize":"11px","color":"var(--faint)","marginBottom":"8px"}}>
                      {txt(p?.location)}
                      {" · last active "}
                      {txt(p?.lastActive)}
                    </div>
                    {arr(p?.perms).map((perm: any, i83: number) => (
                      <Fragment key={i83}>
                        <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"6px 0"}}>
                          <span style={{"flex":"1","fontSize":"12.5px"}}>
                            {txt(perm?.label)}
                          </span>
                          <button onClick={perm?.toggle} style={css(cat("width:34px;height:20px;flex:none;border:0;border-radius:7px;background:", perm?.trackBg, ";cursor:pointer;padding:0;position:relative;transition:background .22s var(--ease)"))}>
                            <span style={css(cat("position:absolute;top:2.5px;left:", perm?.knobLeft, ";width:15px;height:15px;border-radius:6px;background:", perm?.knobBg, ";transition:left .24s var(--ease)"))} />
                          </button>
                        </div>
                      </Fragment>
                    ))}
                    <button onClick={p?.toggleSuspend} style={{"height":"28px","marginTop":"8px","padding":"0 12px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","background":"none","fontSize":"11.5px","color":"var(--bad)","cursor":"pointer"}}>
                      {txt(p?.suspendLabel)}
                    </button>
                  </div>
                </>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}

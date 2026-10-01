import { Fragment } from "react";
import { arr, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function PeopleAddPanel({ v }: Props) {
  return (
    <>
      <div style={{"marginTop":"10px","padding":"14px 16px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-md,13px)","animation":"expandIn .24s var(--ease) both"}}>
        <div style={{"display":"flex","gap":"8px"}}>
          <input value={v.admin?.panel?.people?.form?.name ?? ""} onChange={v.admin?.panel?.people?.setName} placeholder="Name" style={{"flex":"1","minWidth":"0","height":"34px","padding":"0 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-md,12px)","outline":"0","fontSize":"12.5px"}} />
          <input value={v.admin?.panel?.people?.form?.email ?? ""} onChange={v.admin?.panel?.people?.setEmail} placeholder="Email" style={{"flex":"1","minWidth":"0","height":"34px","padding":"0 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-md,12px)","outline":"0","fontSize":"12.5px"}} />
        </div>
        <div style={{"display":"flex","flexWrap":"wrap","gap":"6px","marginTop":"9px"}}>
          {arr(v.admin?.panel?.people?.roleChoices).map((r: any, i78: number) => (
            <Fragment key={i78}>
              <button onClick={r?.pick} style={css(r?.style)}>
                {txt(r?.label)}
              </button>
            </Fragment>
          ))}
          <button className="ixw" onClick={v.admin?.panel?.people?.openNewRole} style={{"display":"flex","alignItems":"center","gap":"6px","height":"28px","padding":"0 12px","borderRadius":"var(--r-ctl,9px)","fontSize":"11.5px","cursor":"pointer","border":"1px dashed var(--border-strong)","background":"none","color":"var(--dim)","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14 M5 12h14" />
            </svg>
            {"New type"}
          </button>
        </div>
        {v.admin?.panel?.people?.newRoleOpen && (
          <>
            <div style={{"marginTop":"11px","padding":"14px","background":"var(--surface-2)","border":"1px solid var(--accent-line)","borderRadius":"var(--r-md,14px)","animation":"expandIn .26s var(--ease) both"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
                <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--accent)"}}>
                  {"NEW ACCOUNT TYPE"}
                </span>
                <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                  {txt(v.admin?.panel?.people?.grantCount)}
                </span>
              </div>
              <input value={v.admin?.panel?.people?.roleDraft?.name ?? ""} onChange={v.admin?.panel?.people?.setRoleName} placeholder="Name this type — e.g. Yard supervisor" style={{"width":"100%","height":"34px","marginTop":"11px","padding":"0 12px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-md,12px)","outline":"0","fontSize":"12.5px","color":"var(--ink)"}} />
              <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)","marginTop":"13px"}}>
                {"SCOPE"}
              </div>
              <div style={{"display":"flex","flexWrap":"wrap","gap":"6px","marginTop":"8px"}}>
                {arr(v.admin?.panel?.people?.roleScopes).map((sc: any, i79: number) => (
                  <Fragment key={i79}>
                    <button onClick={sc?.pick} style={css(sc?.style)}>
                      {txt(sc?.label)}
                    </button>
                  </Fragment>
                ))}
              </div>
              <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)","marginTop":"13px"}}>
                {"PERMISSIONS"}
              </div>
              <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fill,minmax(210px,1fr))","gap":"7px","marginTop":"8px"}}>
                {arr(v.admin?.panel?.people?.roleGrants).map((g: any, i80: number) => (
                  <Fragment key={i80}>
                    <button className="ixz" onClick={g?.toggle} style={css(g?.style)}>
                      <span style={css(g?.boxStyle)}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                      <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                        <span style={{"display":"block","fontSize":"12.5px","color":"var(--ink)"}}>
                          {txt(g?.label)}
                        </span>
                        <span style={{"display":"block","fontSize":"10.5px","color":"var(--faint)","marginTop":"2px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(g?.meta)}
                        </span>
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
              <div style={{"display":"flex","alignItems":"center","gap":"9px","marginTop":"13px"}}>
                <span style={{"flex":"1","minWidth":"0","fontSize":"11px","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                  {"Write and external actions still wait for an approval"}
                </span>
                <button className="ix3" onClick={v.admin?.panel?.people?.closeNewRole} style={{"height":"30px","padding":"0 13px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--dim)","fontSize":"12.5px","cursor":"pointer","transition":"color .2s var(--ease)"}}>
                  {"Cancel"}
                </button>
                <button className="ixb" onClick={v.admin?.panel?.people?.saveRole} style={{"height":"30px","padding":"0 15px","border":"0","borderRadius":"var(--cta-r,10px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"12.5px","fontWeight":"500","cursor":"pointer","transition":"transform .18s var(--ease)"}}>
                  {"Create type"}
                </button>
              </div>
            </div>
          </>
        )}
        {v.admin?.panel?.people?.hasCustomRoles && (
          <>
            <div style={{"display":"flex","flexDirection":"column","gap":"6px","marginTop":"11px"}}>
              {arr(v.admin?.panel?.people?.customRoles).map((r: any, i81: number) => (
                <Fragment key={i81}>
                  <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"9px 12px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","borderRadius":"var(--r-md,12px)"}}>
                    <span style={{"flex":"none","fontSize":"12.5px","color":"var(--ink)"}}>
                      {txt(r?.name)}
                    </span>
                    <span style={{"flex":"none","fontSize":"11px","color":"var(--dim)"}}>
                      {txt(r?.scope)}
                    </span>
                    <span style={{"flex":"1"}} />
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                      {txt(r?.grants)}
                    </span>
                    <button className="ix3" onClick={r?.remove} title="Remove" style={{"flex":"none","width":"20px","height":"20px","border":"0","borderRadius":"50%","background":"none","color":"var(--faint)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease)"}}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        )}
        <button onClick={v.admin?.panel?.people?.addAccount} style={{"height":"32px","marginTop":"11px","padding":"0 15px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"12.5px","fontWeight":"500","cursor":"pointer"}}>
          {"Send invite"}
        </button>
      </div>
    </>
  );
}

import { Fragment } from "react";
import { arr, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function BackgroundGallery({ v }: Props) {
  return (
    <>
      <div onClick={v.bgGallery?.close} style={{"position":"fixed","inset":"0","zIndex":"70","background":"var(--scrim)","backdropFilter":"blur(34px) saturate(1.25)","animation":"scrimIn .32s var(--ease) both"}} />
      <div style={{"position":"fixed","inset":"0","zIndex":"71","display":"flex","alignItems":"center","justifyContent":"center","padding":"34px 24px","pointerEvents":"none"}}>
        <div style={{"pointerEvents":"auto","width":"min(1020px,100%)","maxHeight":"min(82vh,860px)","display":"flex","flexDirection":"column","background":"var(--overlay)","border":"1px solid var(--border-strong)","borderRadius":"var(--card-r,18px)","boxShadow":"0 44px 120px rgba(0,0,0,.62),inset 0 1px 0 var(--glass-highlight)","backdropFilter":"blur(40px) saturate(1.4)","overflow":"hidden","animation":"panelIn .42s cubic-bezier(.16,1,.3,1) both"}}>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"14px","padding":"18px 22px 16px","borderBottom":"1px solid var(--border)"}}>
            <div style={{"flex":"none","position":"relative","width":"78px","height":"50px","borderRadius":"var(--r-md,12px)","overflow":"hidden","border":"1px solid var(--border-strong)"}}>
              <span style={css(v.bgGallery?.heroStyle)} />
            </div>
            <div style={{"flex":"1","minWidth":"0"}}>
              <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--faint)"}}>
                {"HOME BACKGROUND"}
              </div>
              <div style={{"fontSize":"19px","fontWeight":"500","letterSpacing":"-.5px","marginTop":"5px"}}>
                {txt(v.bgGallery?.currentName)}
              </div>
            </div>
            <label className="ixa" style={{"position":"relative","flex":"none","height":"34px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"var(--surface-2)","fontSize":"12.5px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V5 M7.5 9.5 12 5l4.5 4.5 M4.5 19h15" />
              </svg>
              {"Upload\n"}
              <input type="file" accept="image/*" onChange={v.bgGallery?.onUpload} style={{"position":"absolute","inset":"0","opacity":"0","cursor":"pointer","zIndex":"4"}} />
            </label>
            <button className="ixm" onClick={v.bgGallery?.close} title="Close" style={{"flex":"none","width":"34px","height":"34px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M6 6l12 12 M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"7px","padding":"14px 22px 0","overflowX":"auto","scrollbarWidth":"none"}}>
            {arr(v.bgGallery?.cats).map((c: any, i161: number) => (
              <Fragment key={i161}>
                <button onClick={c?.pick} style={css(c?.style)}>
                  {txt(c?.label)}
                  <span style={{"opacity":".6","marginLeft":"7px","fontFamily":"var(--mono)","fontSize":"10px"}}>
                    {txt(c?.count)}
                  </span>
                </button>
              </Fragment>
            ))}
          </div>
          <div onPointerMove={v.bgGallery?.onMove} onPointerLeave={v.bgGallery?.onLeave} onDragOver={v.bgGallery?.onDragOver} onDragLeave={v.bgGallery?.onDragLeave} onDrop={v.bgGallery?.onDrop} style={{"position":"relative","flex":"1","minHeight":"0","overflowY":"auto","padding":"16px 22px 22px"}}>
            <span style={css(v.bgGallery?.spotStyle)} />
            <div style={{"position":"relative","zIndex":"3","display":"grid","gridTemplateColumns":"repeat(auto-fill,minmax(212px,1fr))","gap":"12px"}}>
              {v.bgGallery?.isPhotos && (
                <>
                  <label className="ix1i" style={{"position":"relative","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center","gap":"9px","aspectRatio":"16/10","border":"1px dashed var(--border-strong)","borderRadius":"var(--card-r,18px)","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","transition":"border-color .22s var(--ease),color .22s var(--ease),transform .22s var(--ease)"}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 16.5V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M4 16l5-5 4.5 4.5 M14 13.5l2.5-2.5L20 14" />
                      <path d="M15.5 8.5h.01" />
                    </svg>
                    <span style={{"fontSize":"12.5px"}}>
                      {"Add a photo"}
                    </span>
                    <span style={{"fontSize":"11px","color":"var(--faint)","textAlign":"center","padding":"0 14px","lineHeight":"1.4"}}>
                      {txt(v.bgGallery?.dropHint)}
                    </span>
                    <input type="file" accept="image/*" onChange={v.bgGallery?.onUpload} style={{"position":"absolute","inset":"0","opacity":"0","cursor":"pointer","zIndex":"4"}} />
                  </label>
                </>
              )}
              {arr(v.bgGallery?.tiles).map((t: any, i162: number) => (
                <Fragment key={i162}>
                  <button onClick={t?.pick} style={{"position":"relative","padding":"0","border":"0","background":"none","cursor":"pointer","textAlign":"left"}}>
                    <span className="ix1j" style={{"position":"relative","display":"block","aspectRatio":"16/10","borderRadius":"var(--card-r,18px)","overflow":"hidden","border":"1px solid var(--border)","boxShadow":"0 10px 26px rgba(0,0,0,.34)","transition":"transform .26s var(--ease),border-color .22s var(--ease),box-shadow .26s var(--ease)"}}>
                      <span style={css(t?.thumbStyle)} />
                      {t?.on && (
                        <>
                          <span style={{"position":"absolute","inset":"0","borderRadius":"var(--card-r,18px)","boxShadow":"inset 0 0 0 2px var(--accent)"}} />
                          <span style={{"position":"absolute","right":"9px","bottom":"9px","width":"22px","height":"22px","borderRadius":"var(--cta-r,11px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","display":"flex","alignItems":"center","justifyContent":"center"}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 12.5 4.5 4.5L19 7.5" />
                            </svg>
                          </span>
                        </>
                      )}
                    </span>
                    <span style={{"display":"block","fontSize":"12.5px","color":"var(--body)","marginTop":"9px","paddingLeft":"2px"}}>
                      {txt(t?.name)}
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"13px 22px","borderTop":"1px solid var(--border)"}}>
            <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {"APPLIES TO THE HOME CANVAS · SAVED FOR YOU ONLY"}
            </span>
            <button className="ixb" onClick={v.bgGallery?.close} style={{"flex":"none","height":"34px","padding":"0 18px","border":"0","borderRadius":"var(--cta-r,11px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"transform .18s var(--ease)"}}>
              {"Done"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

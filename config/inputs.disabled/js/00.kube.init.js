loadLib("kube.js");

/*$sec(__, "myBucket", "mySecret")
.setObj("myKube", "Kube", {
    aURL  : "https://mykube.local",
    aUser : "myUser",
    aToken: "myToken"
});*/

$ch("kubeEntries").create();
$ch("kubeEntries").set({ key: "Kube Example" }, { 
    key : "Kube Example", 
    type: "kube",
    secBucket    : "myBucket",
    secBucketPass: "mySecret",
    secObjKey    : "myKube",
    namespace    : "default",
    podTemplate  : "test-"
});
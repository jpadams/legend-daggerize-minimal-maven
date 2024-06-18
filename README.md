# Current Goal:
## Minimal Maven Install via `Engine`, `SDLC`, and `Studio`
https://github.com/finos/legend/blob/master/installers/maven/README.md?plain=1#L3

- [X] `Engine`
- [ ] `SDLC`
- [ ] `Studio`

### Setup **legend-engine**.
Purely from source (2-3 hours)
```
dagger call legend-engine --source https://github.com/finos/legend-engine\#master as-service up
```
Using previous source build (saved via `publish --address ...`)
```
dagger call legend-engine --source https://github.com/finos/legend-engine\#master --use-cached-container as-service up
```

Test by going to http://localhost:6300 in a browser. The Swagger page can be accessed at http://localhost:6300/api/swagger.

### ISSUES:
I was hitting the issue that everyone hits due to reorg of the project/class hierarchy without updating docs or something. I'm able to get past it now after looking for classes that implemented a `main` and choosing one that seemed likely.

Might build fine in JetBrains IntelliJ (haven't tried yet).
Feb 2021: https://github.com/finos/legend/issues/309#issuecomment-781003612
Nov 2022: https://github.com/finos/legend-engine/issues/1173#issuecomment-1319596232 
`java.lang.ClassNotFoundException: org.finos.legend.engine.server.Server`

Follow their docs (that call for wildcard) and you hit a wall after successfully building it. Updated May 2023 by An, but guessing he was focused on the Omnibus by commit message: https://github.com/finos/legend/tree/master/installers/maven#setup-legend-engine


### Progress saved:
Since it takes multiple hours to build the project from source via Maven, I saved the container image just before running the `java -cp ... server` command. You can see this used in the `useCachedContainer` invocation above. 2.23 GB! 
https://hub.docker.com/repository/docker/jeremyatdockerhub/legend-engine-poc/tags
`docker.io/jeremyatdockerhub/legend-engine-poc:latest@sha256:5f2c8256faf99174998c5719c8cd35fa5c8abcbff5022efd9f3162fa56a4cae3`

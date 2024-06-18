# Current Goal

```
dagger call legend-engine --source https://github.com/finos/legend-engine\#master --config ./config.yaml with-exposed-port --port 6300 as-service up
```

### Setup **legend-engine**.

From the root directory of the `legend-engine` repo, follow the steps below in order:

```sh
mvn install [-DskipTests]

# Make sure to replace <path-to-config>
java -cp legend-engine-server/target/*-shaded.jar org.finos.legend.engine.server.Server server <path-to-config>
```

Test by going to http://localhost:6300 in a browser. The Swagger page can be accessed at http://localhost:6300/api/swagger.

### ISSUES:
I'm hitting the issue that everyone hits
Feb 2021: https://github.com/finos/legend/issues/309#issuecomment-781003612
Nov 2022: https://github.com/finos/legend-engine/issues/1173#issuecomment-1319596232 
java.lang.ClassNotFoundException: org.finos.legend.engine.server.Server

Follow their docs (that call for wildcard) and you hit a wall after successfully building it. Updated May 2023 by An, but guessing he was focused on the Omnibus by commit message: https://github.com/finos/legend/tree/master/installers/maven#setup-legend-engine


### Progress saved:
Since it takes multiple hours to build the project from source via Maven, I saved the container image up to the point of rendering the config file with variables and shy of running the `java -cp ... server` command since it doesn't work yet.

`docker.io/jeremyatdockerhub/legend-engine-poc:latest@sha256:5f634fa5543280e14fac5458d1d5b9c0c730410f9e0065f69ae17e725529f2fb`

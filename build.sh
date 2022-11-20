#!/bin/bash
echo "..."
git pull $git_repo
# Build Web
echo "Build..."
# Build
docker run --rm -v "$(pwd)":/opt/maven -v /root/.m2:/root/.m2 -w /opt/maven maven:3-alpine sh -c  "mvn -Dmaven.test.skip=true clean package"
echo "Build Success!"
# 发布
port=8181
#一、根据端口号查询对应的pid,两种都行
pid=$(netstat -nlp | grep :$port | awk '{print $7}' | awk -F"/" '{ print $1 }');
#pid=$(ps -ef | grep 你的进程或端口 | grep -v grep | awk '{print $2}')

#二、杀掉对应的进程，如果pid不存在，则不执行 
if [ -n "$pid" ]; then 
    echo 'Kill $pid'
    kill -9 $pid; 
fi
echo 'Start Server...'
java -jar -Dname=LAN-STREAM -Duser.timezone=GMT+8  ./target/lan-stream-0.0.1-SNAPSHOT.jar --server.port=8181 >/dev/null 2>log 